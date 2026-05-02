import { NextResponse } from "next/server"
import { connectDB, prisma } from "@/lib/db"
import { addNotification } from "@/lib/notifications"
import { calculateStockConsumption, applyStockAdjustment } from "@/lib/stock-logic"
import { validateSession } from "@/lib/auth"
import { getStartOfTodayUTC3 } from "@/lib/time-sync"

// GET all orders with filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = searchParams.get("limit")
    const includeDeleted = searchParams.get("includeDeleted") === "true"
    const mainCategory = searchParams.get("mainCategory") // 'Food' | 'Drinks'
    const period = searchParams.get("period")

    const decoded = await validateSession(request)
    await connectDB()

    const where: any = includeDeleted ? {} : { isDeleted: { not: true } }

    if (period === "today") {
      where.createdAt = { gte: getStartOfTodayUTC3() }
    } else if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    if (decoded.role === "cashier") {
      const assignedFloors = await prisma.floor.findMany({
        where: { roomServiceCashierId: decoded.id },
        select: { id: true }
      })
      const floorIds = assignedFloors.map(f => f.id)
      where.OR = [
        { createdById: decoded.id },
        { floorId: { in: floorIds } }
      ]
    } else if (decoded.role === "display") {
      if (!decoded.floorId) return NextResponse.json([])
      const floorTables = await prisma.table.findMany({
        where: { floorId: decoded.floorId },
        select: { tableNumber: true },
      })
      const tableNumbers = floorTables.map((t) => t.tableNumber)
      where.OR = [{ floorId: decoded.floorId }, { tableNumber: { in: tableNumbers } }]
    }

    if (decoded.role === "chef") {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { assignedCategories: true },
      })
      const assignedCategories = user?.assignedCategories || []
      if (assignedCategories.length === 0) return NextResponse.json([])
      where.items = { some: { category: { in: assignedCategories } } }
    }

    if (mainCategory) {
      where.items = where.items || {}
      where.items.some = { ...(where.items.some || {}), mainCategory }
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit ? Number(limit) : undefined,
      include: {
        items: true,
        createdBy: { select: { name: true } },
        floor: { select: { floorNumber: true } },
      },
    })

    let normalizedAssigned: string[] = []
    if (decoded.role === "chef") {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { assignedCategories: true },
      })
      normalizedAssigned = (user?.assignedCategories || []).map((c) => c.trim().normalize("NFC").toLowerCase())
    }

    const populated = orders.map((o) => {
      let items = (o.items || []).sort((a: any, b: any) => (a.menuId || "").localeCompare(b.menuId || "", undefined, { numeric: true, sensitivity: "base" }))
      if (decoded.role === "chef") {
        items = items.filter((i: any) => i.category && normalizedAssigned.includes(i.category.trim().normalize("NFC").toLowerCase()))
      }
      return {
        ...o,
        _id: o.id,
        floorNumber: o.floorNumber || o.floor?.floorNumber || "",
        items,
      }
    })

    return NextResponse.json(populated)
  } catch (error: any) {
    console.error("❌ Get orders error:", error)
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to get orders" }, { status })
  }
}

// POST create new order
export async function POST(request: Request) {
  try {
    const decoded = await validateSession(request)
    await connectDB()

    const body = await request.json()
    const { items, totalAmount, subtotal, tax, paymentMethod, customerName, tableNumber, tableId, distributions, batchNumber } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "Items are required" }, { status: 400 })
    }
    if (!tableNumber) return NextResponse.json({ message: "Table Number is required" }, { status: 400 })
    if (!totalAmount || totalAmount <= 0) return NextResponse.json({ message: "Valid total amount is required" }, { status: 400 })

    const menuItemIds = items.map((i: any) => i.menuItemId)
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, menuId: true, category: true, mainCategory: true, tier: true, preparationTime: true, price: true, name: true },
    })
    const menuMap = new Map(menuItems.map((m) => [m.id, m]))

    const stockConsumptionMap = await calculateStockConsumption(items)
    const stockIds = Array.from(stockConsumptionMap.keys())
    const stockItems = await prisma.stock.findMany({
      where: { id: { in: stockIds } },
      select: { id: true, name: true, quantity: true, unit: true, trackQuantity: true },
    })
    const stockMap = new Map(stockItems.map((s) => [s.id, s]))

    for (const [stockId, requiredAmount] of stockConsumptionMap) {
      const stockItem = stockMap.get(stockId)
      if (stockItem && (stockItem as any).trackQuantity) {
        const availableStock = (stockItem as any).quantity || 0
        if (availableStock <= 0 || availableStock < requiredAmount) {
          return NextResponse.json(
            {
              message:
                availableStock <= 0
                  ? `Order Failed: ${(stockItem as any).name} is completely out of stock.`
                  : `Insufficient stock: ${(stockItem as any).name}. Required: ${requiredAmount} ${(stockItem as any).unit}, Available: ${availableStock} ${(stockItem as any).unit}`,
              insufficientStock: (stockItem as any).name,
            },
            { status: 400 },
          )
        }
      }
    }

    // Determine floor from explicit input, table, or cashier assignment
    let floorId = body.floorId || null
    let floorNumber = body.floorNumber || ""
    let resolvedTableId = tableId || null

    if (!resolvedTableId && tableNumber && tableNumber !== "Buy&Go") {
      const table = await prisma.table.findUnique({ where: { tableNumber }, select: { id: true, floorId: true } })
      if (table) {
        resolvedTableId = table.id
        floorId = floorId || table.floorId
      }
    }

    if (!floorId && decoded.role === "cashier" && decoded.floorId) floorId = decoded.floorId
    if (floorId && !floorNumber) {
      const floor = await prisma.floor.findUnique({ where: { id: floorId }, select: { floorNumber: true } })
      if (floor) floorNumber = floor.floorNumber
    }

    const isBuyAndGo = tableNumber === "Buy&Go"

    // Order number (daily counter with retry on unique constraint)
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    const orderCount = await prisma.order.count({ where: { createdAt: { gte: start, lt: end } } })
    let seq = orderCount + 1

    let created: any = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const orderNumber = String(seq).padStart(3, "0")
      try {
        created = await prisma.order.create({
          data: {
            orderNumber,
            totalAmount,
            subtotal: subtotal || totalAmount,
            tax: tax || 0,
            status: isBuyAndGo ? "completed" : "preparing",
            paymentMethod: paymentMethod || "cash",
            customerName: customerName || `Table ${tableNumber}`,
            tableNumber,
            batchNumber: batchNumber ? String(batchNumber).trim() : null,
            tableId: resolvedTableId,
            floorId,
            floorNumber,
            distributions: distributions || [],
            createdById: decoded.id,
            items: {
              create: items
                .map((item: any) => {
                  const menu = menuMap.get(item.menuItemId)
                  const isDrink = (menu as any)?.mainCategory?.toLowerCase() === "drinks"
                  return {
                    menuItemId: item.menuItemId,
                    menuId: (menu as any)?.menuId,
                    name: (menu as any)?.name || item.name || "",
                    quantity: Number(item.quantity || 1),
                    price: Number(item.price ?? (menu as any)?.price ?? 0),
                    status: isBuyAndGo ? "completed" : "pending",
                    modifiers: item.modifiers || [],
                    notes: item.notes || "",
                    category: (menu as any)?.category,
                    mainCategory: (menu as any)?.mainCategory,
                    menuTier: (item.menuTier || (menu as any)?.tier || "standard") as any,
                    preparationTime: isDrink ? 0 : ((menu as any)?.preparationTime || 0),
                  }
                })
                .sort((a: any, b: any) => (a.menuId || "").localeCompare(b.menuId || "", undefined, { numeric: true, sensitivity: "base" })),
            },
          },
          include: { items: true },
        })

        // AUTO-COMPLETE PURE DRINK ORDERS:
        // If it's 100% drinks (prepTime 0), we don't want it to show up as "Cooking" in the Admin
        const allItemsInstant = created.items.every((it: any) => it.preparationTime === 0)
        if (allItemsInstant && created.status !== "completed") {
          const finalStatus = "served" // Drinks are ready immediately
          await prisma.orderItem.updateMany({
            where: { orderId: created.id },
            data: { status: finalStatus }
          })
          created = await prisma.order.update({
            where: { id: created.id },
            data: { 
              status: finalStatus,
              items: created.items.map((it: any) => ({ ...it, status: finalStatus }))
            },
            include: { items: true }
          })
        }
        break
      } catch (e: any) {
        if (e.code === "P2002") {
          seq++
          continue
        }
        throw e
      }
    }

    if (!created) throw new Error("Failed to create order")

    await applyStockAdjustment(stockConsumptionMap, -1)

    try {
      addNotification("info", `🍽️ New Order #${created.orderNumber} - ${created.items.length} items (${created.totalAmount} Br)`, "chef")
      addNotification("success", `✅ Order #${created.orderNumber} created successfully`, "cashier")
      addNotification("info", `📋 New Order #${created.orderNumber} received - Total: ${created.totalAmount} Br`, "admin")
    } catch { }

    return NextResponse.json({ ...created, _id: created.id }, { status: 201 })
  } catch (error: any) {
    console.error("Create order error:", error)
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to create order" }, { status })
  }
}
