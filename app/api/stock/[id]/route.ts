import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request, context: any) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { id } = await context.params
        const stockItem = await prisma.stock.findUnique({
            where: { id },
            include: {
                restockHistory: {
                    include: { restockedBy: { select: { id: true, name: true, email: true } } },
                    orderBy: { date: 'desc' }
                }
            }
        })

        if (!stockItem) {
            return NextResponse.json({ message: "Stock item not found" }, { status: 404 })
        }

        const serializedStock = {
            ...stockItem,
            _id: stockItem.id,
            totalValue: (stockItem.quantity || 0) * (stockItem.unitCost || 0),
            isLowStock: stockItem.trackQuantity && (stockItem.quantity || 0) <= (stockItem.minLimit || 0),
            isLowStoreStock: stockItem.trackQuantity && (stockItem.storeQuantity || 0) <= (stockItem.storeMinLimit || 0),
            isOutOfStock: stockItem.trackQuantity && (stockItem.quantity || 0) <= 0,
            availableForOrder: stockItem.trackQuantity ? (stockItem.status === 'active' && (stockItem.quantity || 0) > 0) : true,
            sellUnitEquivalent: stockItem.sellUnitEquivalent || 1,
            restockHistory: stockItem.restockHistory?.map(entry => ({
                ...entry,
                _id: entry.id,
                restockedBy: entry.restockedBy ? {
                    ...entry.restockedBy,
                    _id: entry.restockedBy.id
                } : null
            })) || []
        }

        return NextResponse.json(serializedStock)
    } catch (error: any) {
        console.error("❌ Get stock item error:", error)
        return NextResponse.json({ message: "Failed to get stock item" }, { status: 500 })
    }
}

export async function PUT(request: Request, context: any) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { id } = await context.params
        const stockItem = await prisma.stock.findUnique({ where: { id } })
        if (!stockItem) {
            return NextResponse.json({ message: "Stock item not found" }, { status: 404 })
        }

        if (body.action === 'restock' && body.quantityAdded && body.totalPurchaseCost) {
            const quantityAdded = Number(body.quantityAdded)
            const totalPurchaseCost = Number(body.totalPurchaseCost)
            const newUnitCost = Number(body.newUnitCost || stockItem.unitCost)

            // Replicate stockItem.restock logic dynamically
            const currentTotalQty = stockItem.quantity + stockItem.storeQuantity
            const currentTotalValue = currentTotalQty * stockItem.averagePurchasePrice
            const newAveragePurchasePrice = (currentTotalValue + totalPurchaseCost) / (currentTotalQty + quantityAdded)

            const updatedStock = await prisma.stock.update({
                where: { id },
                data: {
                    storeQuantity: stockItem.storeQuantity + quantityAdded,
                    totalPurchased: stockItem.totalPurchased + quantityAdded,
                    totalInvestment: stockItem.totalInvestment + totalPurchaseCost,
                    averagePurchasePrice: newAveragePurchasePrice,
                    unitCost: newUnitCost
                }
            })

            await prisma.storeLog.create({
                data: {
                    stockId: id,
                    type: 'PURCHASE' as any,
                    quantity: quantityAdded,
                    unit: stockItem.unit,
                    pricePerUnit: totalPurchaseCost / quantityAdded,
                    totalPrice: totalPurchaseCost,
                    userId: decoded.id,
                    notes: body.notes || "Manual restock (Store)"
                }
            })

            await prisma.stockRestockEntry.create({
                data: {
                    stockId: id,
                    quantityAdded,
                    totalPurchaseCost,
                    unitCostAtTime: stockItem.unitCost,
                    notes: body.notes || "Restocked via admin panel",
                    restockedById: decoded.id
                }
            })

            const serializedStock = {
                ...updatedStock,
                _id: updatedStock.id,
                totalValue: updatedStock.quantity * updatedStock.averagePurchasePrice,
                sellingValue: updatedStock.quantity * updatedStock.unitCost,
                profitMargin: updatedStock.unitCost > 0 ? ((updatedStock.unitCost - updatedStock.averagePurchasePrice) / updatedStock.unitCost * 100).toFixed(1) : 0,
                isLowStock: updatedStock.trackQuantity && updatedStock.quantity <= updatedStock.minLimit,
                isLowStoreStock: updatedStock.trackQuantity && updatedStock.storeQuantity <= updatedStock.storeMinLimit,
                isOutOfStock: updatedStock.trackQuantity && updatedStock.quantity <= 0,
                availableForOrder: updatedStock.trackQuantity ? (updatedStock.status === 'active' && updatedStock.quantity > 0) : true
            }

            return NextResponse.json({
                ...serializedStock,
                message: `Successfully restocked. New parameters applied.`
            })
        }

        const allowedUpdates = ['name', 'category', 'unit', 'unitType', 'minLimit', 'storeMinLimit', 'trackQuantity', 'showStatus', 'status', 'storeQuantity', 'totalInvestment', 'isVIP', 'vipLevel']
        const updateData: any = {}

        for (const key of allowedUpdates) {
            if (body[key] !== undefined) {
                updateData[key] = body[key]
            }
        }

        if (body.totalPurchaseCost !== undefined) updateData.totalInvestment = Number(body.totalPurchaseCost)
        if (body.quantity !== undefined) updateData.quantity = Math.max(0, Number(body.quantity))
        if (body.averagePurchasePrice !== undefined) updateData.averagePurchasePrice = Math.max(0, Number(body.averagePurchasePrice))
        if (body.unitCost !== undefined) updateData.unitCost = Math.max(0, Number(body.unitCost))

        if (body.unit !== undefined) {
            const unit = body.unit.toLowerCase()
            if (['kg', 'g', 'gram', 'kilogram'].includes(unit)) updateData.unitType = 'weight' as any
            else if (['l', 'ml', 'liter', 'litre', 'milliliter'].includes(unit)) updateData.unitType = 'volume' as any
            else updateData.unitType = 'count' as any
        }
        
        updateData.sellUnitEquivalent = 1

        const savedStock = await prisma.stock.update({
            where: { id },
            data: updateData
        })

        const serializedStock = {
            ...savedStock,
            _id: savedStock.id,
            totalValue: savedStock.quantity * savedStock.averagePurchasePrice,
            sellingValue: savedStock.quantity * savedStock.unitCost,
            profitMargin: savedStock.unitCost > 0 ? ((savedStock.unitCost - savedStock.averagePurchasePrice) / savedStock.unitCost * 100).toFixed(1) : 0,
            isLowStock: savedStock.trackQuantity && savedStock.quantity <= savedStock.minLimit,
            isLowStoreStock: savedStock.trackQuantity && savedStock.storeQuantity <= savedStock.storeMinLimit,
            isOutOfStock: savedStock.trackQuantity && savedStock.quantity <= 0,
            availableForOrder: savedStock.trackQuantity ? (savedStock.status === 'active' && savedStock.quantity > 0) : true
        }

        return NextResponse.json(serializedStock)
    } catch (error: any) {
        console.error("❌ Update stock error:", error)
        return NextResponse.json({ message: "Failed to update stock item" }, { status: 500 })
    }
}

export async function DELETE(request: Request, context: any) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { id } = await context.params
        const { searchParams } = new URL(request.url)
        const source = searchParams.get("source") // 'stock' or 'store'
        
        const stockItem = await prisma.stock.findUnique({ where: { id } })

        if (!stockItem) {
            return NextResponse.json({ message: "Stock item not found" }, { status: 404 })
        }

        if (source === 'store') {
            const hasActiveStock = (stockItem.quantity || 0) > 0
            await prisma.stock.update({ where: { id }, data: { storeQuantity: 0 } })
            
            if (hasActiveStock) {
                return NextResponse.json({ message: "Item removed from Store. Active stock in POS remains.", keepInPOS: true })
            } else {
                return NextResponse.json({ message: "Item removed from Store. Record kept for history.", keepRecord: true })
            }
        }

        const hasStoreQuantity = (stockItem.storeQuantity || 0) > 0
        await prisma.stock.update({ where: { id }, data: { quantity: 0, status: 'out_of_stock' as any } })
        
        if (hasStoreQuantity) {
            return NextResponse.json({ message: "Stock removed from POS, but kept in Store because it has remaining quantity.", keepInStore: true })
        } else {
            return NextResponse.json({ message: "Stock removed from POS. Record kept for history.", keepRecord: true })
        }
    } catch (error: any) {
        console.error("❌ Delete stock error:", error)
        return NextResponse.json({ message: "Failed to delete stock item" }, { status: 500 })
    }
}