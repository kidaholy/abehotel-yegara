import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const includeHistory = searchParams.get("includeHistory") === "true"
        const availableOnly = searchParams.get("availableOnly") === "true"
        const category = searchParams.get("category")
        const vipLevel = searchParams.get("vipLevel")
        const isVIP = searchParams.get("isVIP") === "true"

        const decoded = await validateSession(request)

        if (decoded.role !== "admin" && decoded.role !== "super-admin" && decoded.role !== "store_keeper" && !(decoded.role === "custom" && decoded.permissions?.includes("stock:view"))) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        let where: any = {}
        if (availableOnly) {
            where.status = 'active'
            where.quantity = { gt: 0 }
        }
        if (category) {
            where.category = category
        }
        if (searchParams.has('isVIP')) {
            where.isVIP = isVIP
        }
        if (vipLevel) {
            where.vipLevel = Number(vipLevel)
        }

        const stockItems = await prisma.stock.findMany({
            where,
            orderBy: { name: 'asc' },
            include: includeHistory ? { restockHistory: true } : undefined
        })

        const serializedItems = stockItems.map(item => {
            const avgPurchasePrice = item.averagePurchasePrice || (item as any).purchasePrice || 0

            return {
                ...item,
                _id: item.id,
                averagePurchasePrice: avgPurchasePrice,
                storeQuantity: item.storeQuantity || 0,
                totalValue: (item.quantity || 0) * avgPurchasePrice,
                storeValue: (item.storeQuantity || 0) * avgPurchasePrice,
                totalLifetimeInvestment: item.totalInvestment || 0,
                totalLifetimePurchased: item.totalPurchased || 0,
                sellingValue: (item.quantity || 0) * (item.unitCost || 0),
                profitMargin: (item.unitCost || 0) > 0 ? (((item.unitCost - avgPurchasePrice) / item.unitCost) * 100).toFixed(1) : 0,
                isLowStock: item.trackQuantity && (item.quantity || 0) <= (item.minLimit || 0),
                isLowStoreStock: item.trackQuantity && (item.storeQuantity || 0) <= (item.storeMinLimit || 0),
                isOutOfStock: item.trackQuantity && (item.quantity || 0) <= 0,
                availableForOrder: item.trackQuantity ? (item.status === 'active' && (item.quantity || 0) > 0) : true,
                sellUnitEquivalent: item.sellUnitEquivalent || 1
            }
        })

        return NextResponse.json(serializedItems)
    } catch (error: any) {
        console.error("❌ Get stock error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to get stock items" }, { status })
    }
}

export async function POST(request: Request) {
    try {
        const decoded = await validateSession(request)

        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()

        let unitType = 'count'
        const unit = body.unit?.toLowerCase()
        if (['kg', 'g', 'gram', 'kilogram'].includes(unit)) {
            unitType = 'weight'
        } else if (['l', 'ml', 'liter', 'litre', 'milliliter'].includes(unit)) {
            unitType = 'volume'
        }

        const storeQuantity = Number(body.storeQuantity || body.quantity) || 0
        const totalInvestment = body.totalPurchaseCost || 0
        const averagePurchasePrice = Number(body.averagePurchasePrice) || Number(body.unitPurchasedPrice) || 0

        const newStock = await prisma.stock.create({
            data: {
                name: body.name,
                category: body.category,
                unit: body.unit,
                unitType: unitType as any,
                quantity: 0,
                storeQuantity,
                minLimit: Number(body.minLimit) || 0,
                storeMinLimit: Number(body.storeMinLimit) || 0,
                averagePurchasePrice,
                unitCost: Number(body.unitCost) || 0,
                totalPurchased: storeQuantity,
                totalConsumed: 0,
                totalInvestment,
                sellUnitEquivalent: 1,
                isVIP: body.isVIP || false,
                vipLevel: Number(body.vipLevel) || 1,
                status: 'active' as any,
                trackQuantity: body.trackQuantity ?? true,
                showStatus: body.showStatus ?? true
            }
        })

        if (storeQuantity > 0) {
            await prisma.storeLog.create({
                data: {
                    stockId: newStock.id,
                    type: 'PURCHASE' as any,
                    quantity: storeQuantity,
                    unit: body.unit || '',
                    pricePerUnit: averagePurchasePrice,
                    totalPrice: totalInvestment,
                    userId: decoded.id,
                    notes: "Initial inventory entry (Store)"
                }
            })

            await prisma.stockRestockEntry.create({
                data: {
                    stockId: newStock.id,
                    quantityAdded: storeQuantity,
                    totalPurchaseCost: Number(body.totalPurchaseCost) || 0,
                    unitCostAtTime: newStock.unitCost,
                    notes: "Initial store entry",
                    restockedById: decoded.id
                }
            })
        }

        const serializedStock = {
            ...newStock,
            _id: newStock.id,
            totalValue: (newStock.quantity + newStock.storeQuantity) * newStock.averagePurchasePrice,
            sellingValue: (newStock.quantity + newStock.storeQuantity) * newStock.unitCost,
            profitMargin: newStock.unitCost > 0 ? ((newStock.unitCost - newStock.averagePurchasePrice) / newStock.unitCost * 100).toFixed(1) : 0,
            isLowStock: newStock.trackQuantity && newStock.quantity <= newStock.minLimit,
            isLowStoreStock: newStock.trackQuantity && newStock.storeQuantity <= newStock.storeMinLimit,
            isOutOfStock: newStock.trackQuantity && newStock.quantity <= 0,
            availableForOrder: newStock.trackQuantity ? (newStock.status === 'active' && newStock.quantity > 0) : true
        }

        return NextResponse.json(serializedStock, { status: 201 })
    } catch (error: any) {
        console.error("❌ Create stock error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to create stock item" }, { status })
    }
}
