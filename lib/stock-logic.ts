import { prisma } from "@/lib/db"

/**
 * Calculates the total stock consumption for a list of order items.
 * Handles both Recipe system and Legacy stockItemId/reportQuantity system.
 */
export async function calculateStockConsumption(items: any[]) {
    const stockConsumptionMap = new Map<string, number>()
    const menuItemIds = items.map(i => i.menuItemId)
    
    const linkedMenuItems = await prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        select: {
            id: true,
            stockItemId: true,
            reportQuantity: true,
            recipe: {
                select: {
                    stockItemId: true,
                    quantityRequired: true,
                }
            },
            stockItem: { select: { id: true } }
        }
    })

    for (const orderItem of items) {
        const menuData = linkedMenuItems.find(m => m.id === orderItem.menuItemId)
        if (!menuData) continue

        // 1. Check Recipe System (Priority)
        if (menuData.recipe && menuData.recipe.length > 0) {
            for (const ingredient of menuData.recipe) {
                const stockId = ingredient.stockItemId
                const perItemQuantity = ingredient.quantityRequired ?? 0
                const consumptionAmount = perItemQuantity * orderItem.quantity
                stockConsumptionMap.set(stockId, (stockConsumptionMap.get(stockId) || 0) + consumptionAmount)
            }
        }
        // 2. Fallback to Legacy System
        else if (menuData.stockItemId && (menuData.reportQuantity || 0) > 0) {
            const stockId = menuData.stockItemId
            const consumptionAmount = menuData.reportQuantity * orderItem.quantity
            stockConsumptionMap.set(stockId, (stockConsumptionMap.get(stockId) || 0) + consumptionAmount)
        }
    }

    return stockConsumptionMap
}

/**
 * Adjusts stock levels based on a consumption map and a direction.
 * direction: -1 to DEDUCT stock (order creation)
 * direction: 1 to RESTORE stock (order cancellation)
 */
export async function applyStockAdjustment(consumptionMap: Map<string, number>, direction: -1 | 1) {
    if (consumptionMap.size === 0) return []

    const stockIds = Array.from(consumptionMap.keys())
    const stockItems = await prisma.stock.findMany({
        where: { id: { in: stockIds } },
        select: {
            id: true,
            name: true,
            quantity: true,
            totalConsumed: true,
            status: true,
            trackQuantity: true,
        }
    })

    const updates: any[] = []
    const results: any[] = []

    for (const stockItem of stockItems) {
        if (!stockItem.trackQuantity) continue

        const amount = consumptionMap.get(stockItem.id) || 0
        const change = amount * direction

        const oldQuantity = stockItem.quantity || 0
        const newQuantity = Math.max(0, oldQuantity + change)

        const totalConsumedChange = direction === -1 ? amount : -amount
        const newTotalConsumed = Math.max(0, (stockItem.totalConsumed || 0) + totalConsumedChange)

        let newStatus: any = stockItem.status
        if (newQuantity > 0 && (stockItem.status === "finished" || stockItem.status === "out_of_stock")) {
            newStatus = "active"
        } else if (newQuantity === 0 && stockItem.status !== "out_of_stock" && stockItem.status !== "finished") {
            newStatus = "out_of_stock"
        }

        updates.push(
            prisma.stock.update({
                where: { id: stockItem.id },
                data: {
                    quantity: newQuantity,
                    totalConsumed: newTotalConsumed,
                    status: newStatus,
                },
            }),
        )

        results.push({
            name: stockItem.name,
            oldQuantity,
            newQuantity,
            change: direction === -1 ? -amount : amount
        })
    }

    if (updates.length > 0) {
        await prisma.$transaction(updates)
    }

    return results
}
