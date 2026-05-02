import { NextResponse } from "next/server"
import { connectDB, prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"
import { calculateStockConsumption, applyStockAdjustment } from "@/lib/stock-logic"

// POST process order with real-time stock validation and deduction
export async function POST(request: Request) {
    try {
        const decoded = await validateSession(request)

        await connectDB()

        const body = await request.json()
        const { orderItems, tableNumber, customerName, paymentMethod } = body

        console.log(`🍽️ Processing order for table ${tableNumber} with ${orderItems.length} items`)

        // Step 1: Validate all menu items and check stock availability
        const validationResults: any[] = []

        const menuIds = orderItems.map((i: any) => i.menuId)
        const menuItems = await prisma.menuItem.findMany({
            where: { menuId: { in: menuIds } },
            include: { recipe: true },
        })
        const menuByMenuId = new Map(menuItems.map((m) => [m.menuId, m]))

        for (const orderItem of orderItems) {
            const menuItem: any = menuByMenuId.get(orderItem.menuId)
            if (!menuItem) {
                return NextResponse.json({ message: `Menu item ${orderItem.menuId} not found`, type: "validation_error" }, { status: 400 })
            }

            const missingIngredients: string[] = []

            if (menuItem.recipe && menuItem.recipe.length > 0) {
                const stockIds = menuItem.recipe.map((r: any) => r.stockItemId)
                const stocks = await prisma.stock.findMany({
                    where: { id: { in: stockIds } },
                    select: { id: true, name: true, quantity: true, unit: true, trackQuantity: true, status: true },
                })
                const stockMap = new Map(stocks.map((s) => [s.id, s]))

                for (const ing of menuItem.recipe) {
                    const s = stockMap.get(ing.stockItemId)
                    const required = (ing.quantityRequired || 0) * (orderItem.quantity || 0)
                    if (s && s.trackQuantity) {
                        if ((s.quantity || 0) < required || s.status !== "active") {
                            missingIngredients.push(`${s.name} (need ${required} ${s.unit})`)
                        }
                    }
                }
            } else if (menuItem.stockItemId && (menuItem.reportQuantity || 0) > 0) {
                const s = await prisma.stock.findUnique({
                    where: { id: menuItem.stockItemId },
                    select: { name: true, quantity: true, unit: true, trackQuantity: true, status: true },
                })
                const required = (menuItem.reportQuantity || 0) * (orderItem.quantity || 0)
                if (s && s.trackQuantity) {
                    if ((s.quantity || 0) < required || s.status !== "active") {
                        missingIngredients.push(`${s.name} (need ${required} ${s.unit})`)
                    }
                }
            }

            if (missingIngredients.length > 0) {
                return NextResponse.json({
                    message: `Cannot prepare ${menuItem.name}`,
                    details: missingIngredients,
                    type: "stock_unavailable",
                    unavailableItem: { menuId: orderItem.menuId, name: menuItem.name, missingIngredients }
                }, { status: 409 })
            }

            validationResults.push({
                menuId: orderItem.menuId,
                name: menuItem.name,
                quantity: orderItem.quantity,
                available: true
            })
        }

        console.log(`✅ All ${orderItems.length} items validated and available`)

        // Step 2: Generate order number
        const today = new Date()
        const dateStr = today.toISOString().split('T')[0].replace(/-/g, '')
        const orderCount = await prisma.order.count({
            where: {
                createdAt: {
                    gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                    lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
                }
            }
        })
        const orderNumber = String(orderCount + 1).padStart(3, '0')

        // Step 3: Create order object
        const orderData: any = {
            orderNumber,
            items: {
                create: orderItems.map((item: any) => {
                    const m: any = menuByMenuId.get(item.menuId)
                    return {
                        menuItemId: m?.id,
                        menuId: item.menuId,
                        name: m?.name || item.menuId,
                        quantity: item.quantity,
                        price: m?.price || 0,
                        status: "pending",
                        modifiers: item.modifiers || [],
                        notes: item.notes || "",
                        category: m?.category,
                        mainCategory: m?.mainCategory,
                        menuTier: m?.tier,
                    }
                })
            },
            totalAmount: orderItems.reduce((sum: number, item: any) => {
                const m: any = menuByMenuId.get(item.menuId)
                return sum + ((m?.price || 0) * item.quantity)
            }, 0),
            status: "pending",
            paymentMethod: paymentMethod || "cash",
            customerName: customerName || "",
            tableNumber: tableNumber.toString(),
            createdById: decoded.id
        }

        // Step 4: Create the order first
        const newOrder = await prisma.order.create({
            data: orderData,
            include: { items: true }
        })

        console.log(`📝 Order ${orderNumber} created successfully`)

        // Step 5: Deduct stock using shared logic
        const stockConsumptionMap = await calculateStockConsumption(newOrder.items)
        await applyStockAdjustment(stockConsumptionMap, -1)

        // Step 6: Return success response with order details and stock consumption log
        const response = {
            success: true,
            order: {
                ...newOrder,
                _id: newOrder.id
            },
            validation: validationResults,
            message: `Order ${orderNumber} processed successfully. Stock has been deducted.`
        }

        return NextResponse.json(response, { status: 201 })

    } catch (error: any) {
        console.error("❌ Process order error:", error)
        return NextResponse.json({
            message: "Failed to process order",
            type: "server_error"
        }, { status: 500 })
    }
}

// GET check menu item availability (for real-time validation)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const menuIds = searchParams.get("menuIds")?.split(",") || []
        const quantities = searchParams.get("quantities")?.split(",").map(Number) || []

        await validateSession(request)

        await connectDB()

        const availabilityCheck: any[] = []

        for (let i = 0; i < menuIds.length; i++) {
            const menuId = menuIds[i]
            const quantity = quantities[i] || 1

            const menuItem: any = await prisma.menuItem.findUnique({
                where: { menuId },
                include: { recipe: true },
            })
            if (!menuItem) {
                availabilityCheck.push({
                    menuId,
                    available: false,
                    reason: "Menu item not found"
                })
                continue
            }

            const missingIngredients: string[] = []
            if (menuItem.recipe && menuItem.recipe.length > 0) {
                const stockIds = menuItem.recipe.map((r: any) => r.stockItemId)
                const stocks = await prisma.stock.findMany({
                    where: { id: { in: stockIds } },
                    select: { id: true, name: true, quantity: true, unit: true, trackQuantity: true, status: true },
                })
                const stockMap = new Map(stocks.map((s) => [s.id, s]))
                for (const ing of menuItem.recipe) {
                    const s = stockMap.get(ing.stockItemId)
                    const required = (ing.quantityRequired || 0) * quantity
                    if (s && s.trackQuantity) {
                        if ((s.quantity || 0) < required || s.status !== "active") {
                            missingIngredients.push(`${s.name} (need ${required} ${s.unit})`)
                        }
                    }
                }
            }

            availabilityCheck.push({
                menuId,
                name: menuItem.name,
                available: missingIngredients.length === 0,
                missingIngredients,
                requestedQuantity: quantity
            })
        }

        return NextResponse.json({
            availabilityCheck,
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error("❌ Check availability error:", error)
        return NextResponse.json({
            message: "Failed to check availability"
        }, { status: 500 })
    }
}