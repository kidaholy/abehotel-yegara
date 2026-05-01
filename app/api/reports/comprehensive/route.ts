import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const period = searchParams.get("period") || "today"
        const format = searchParams.get("format") || "json"

        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        let startDate = new Date()
        let endDate = new Date()
        endDate.setHours(23, 59, 59, 999)

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        switch (period) {
            case "today":
                startDate = today
                break
            case "week":
                const day = today.getDay()
                const diff = today.getDate() - day + (day === 0 ? -6 : 1)
                startDate = new Date(today.setDate(diff))
                startDate.setHours(0, 0, 0, 0)
                break
            case "month":
                startDate = new Date(today.getFullYear(), today.getMonth(), 1)
                break
            case "year":
                startDate = new Date(today.getFullYear(), 0, 1)
                break
        }

        const orders = await prisma.order.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                status: { not: "cancelled" }
            },
            include: { items: true },
            orderBy: { createdAt: 'desc' }
        })
        const stockItems = await prisma.stock.findMany()
        const menuItems = await prisma.menuItem.findMany({
            include: { recipe: true }
        })
        const dailyExpenses = await prisma.dailyExpense.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        })

        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0)
        const totalOrders = orders.length
        const completedOrders = orders.filter(o => o.status === "completed").length

        const totalOtherExpenses = dailyExpenses.reduce((sum, exp) => sum + (exp.otherExpenses || 0), 0)

        const totalStockValue = stockItems
            .reduce((sum, item) => sum + (((item.quantity || 0) + (item.storeQuantity || 0)) * (item.averagePurchasePrice || item.unitCost || 0)), 0)

        const totalInvestment = totalOtherExpenses + totalStockValue
        const totalLifetimeInvestment = stockItems.reduce((sum, item) => sum + (item.totalInvestment || 0), 0)

        const netProfit = totalRevenue - totalInvestment
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

        const menuMap = new Map(menuItems.map(m => [m.id, m]))
        const stockConsumption: Record<string, { name: string, consumed: number, unit: string, cost: number }> = {}

        orders.forEach(order => {
            if (order.status === "completed") {
                let parsedItems = []
                if (typeof order.items === 'string') {
                    try { parsedItems = JSON.parse(order.items) } catch {}
                } else if (Array.isArray(order.items)) {
                    parsedItems = order.items
                }

                parsedItems.forEach((item: any) => {
                    const menuData = menuMap.get(item.menuItemId)
                    if (menuData) {
                        if (menuData.recipe && menuData.recipe.length > 0) {
                            menuData.recipe.forEach((ingredient: any) => {
                                const stockItem = stockItems.find(s => s.id === ingredient.stockItemId)
                                if (stockItem) {
                                    const perItemQuantity = ingredient.quantityRequired ?? (ingredient as any).quantity ?? 0
                                    const consumedAmount = perItemQuantity * item.quantity
                                    const key = stockItem.name

                                    if (!stockConsumption[key]) {
                                        stockConsumption[key] = {
                                            name: stockItem.name,
                                            consumed: 0,
                                            unit: stockItem.unit || '',
                                            cost: 0
                                        }
                                    }
                                    stockConsumption[key].consumed += consumedAmount
                                    stockConsumption[key].cost += consumedAmount * (stockItem.averagePurchasePrice || stockItem.unitCost || 0)
                                }
                            })
                        }
                        else if (menuData.stockItemId && menuData.reportQuantity) {
                            const stockItem = stockItems.find(s => s.id === menuData.stockItemId)
                            if (stockItem) {
                                const consumedAmount = menuData.reportQuantity * item.quantity
                                const key = stockItem.name

                                if (!stockConsumption[key]) {
                                    stockConsumption[key] = {
                                        name: stockItem.name,
                                        consumed: 0,
                                        unit: stockItem.unit || '',
                                        cost: 0
                                    }
                                }
                                stockConsumption[key].consumed += consumedAmount
                                stockConsumption[key].cost += consumedAmount * (stockItem.averagePurchasePrice || stockItem.unitCost || 0)
                            }
                        }
                    }
                })
            }
        })

        const lowStockAlerts = stockItems
            .filter(item => item.trackQuantity && item.minLimit && (item.quantity || 0) <= (item.minLimit || 0))
            .map(item => ({
                name: item.name,
                current: item.quantity || 0,
                minimum: item.minLimit || 0,
                unit: item.unit || '',
                urgency: (item.quantity || 0) === 0 ? 'critical' as const : 'warning' as const
            }))

        const categoryStats = new Map<string, { revenue: number, orders: number }>()
        orders.forEach(order => {
            let parsedItems = []
            if (typeof order.items === 'string') {
                try { parsedItems = JSON.parse(order.items) } catch {}
            } else if (Array.isArray(order.items)) {
                parsedItems = order.items
            }
            parsedItems.forEach((item: any) => {
                const menuData = menuMap.get(item.menuItemId)
                const category = menuData?.category || 'Unknown'
                const existing = categoryStats.get(category) || { revenue: 0, orders: 0 }
                existing.revenue += item.price * item.quantity
                existing.orders += 1
                categoryStats.set(category, existing)
            })
        })

        const totalCategoryRevenue = Array.from(categoryStats.values()).reduce((sum, cat) => sum + cat.revenue, 0)
        const categoryPerformance = Array.from(categoryStats.entries()).map(([category, data]) => ({
            category,
            ...data,
            percentage: totalCategoryRevenue > 0 ? (data.revenue / totalCategoryRevenue) * 100 : 0
        }))

        const comprehensiveReport = {
            period,
            startDate,
            endDate,
            generatedAt: new Date(),

            financial: {
                totalRevenue,
                totalOtherExpenses,
                totalStockValue,
                totalInvestment,
                totalLifetimeInvestment,
                netProfit,
                profitMargin
            },

            operational: {
                totalOrders,
                completedOrders,
                averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
                completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
            },

            inventory: {
                totalStockValue,
                lowStockAlerts,
                stockConsumption: Object.values(stockConsumption),
                categoryPerformance
            },

            orders: orders.map(order => ({
                orderNumber: order.orderNumber,
                date: order.createdAt,
                status: order.status,
                totalAmount: order.totalAmount,
                paymentMethod: order.paymentMethod,
                itemsCount: Array.isArray(order.items) ? order.items.length : 0
            })),

            stockItems: stockItems.map(item => ({
                name: item.name,
                category: item.category,
                quantity: item.quantity,
                unit: item.unit,
                unitCost: item.unitCost,
                totalValue: (item.quantity || 0) * (item.unitCost || 0),
                status: item.status
            })),

            dailyExpenses: dailyExpenses.map(exp => ({
                date: exp.date,
                otherExpenses: exp.otherExpenses,
                items: exp.items
            }))
        }

        return NextResponse.json(comprehensiveReport)

    } catch (error: any) {
        console.error("❌ Comprehensive Report Error:", error)
        return NextResponse.json({ message: "Failed to generate comprehensive report" }, { status: 500 })
    }
}