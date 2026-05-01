import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const period = searchParams.get("period") || "today"
        const customStart = searchParams.get("startDate")
        const customEnd = searchParams.get("endDate")

        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

        let startDate = new Date()
        let endDate = new Date()

        // Set time to end of day for endDate
        endDate.setHours(23, 59, 59, 999)

        // Calculate start date based on period
        if (customStart && customEnd) {
            startDate = new Date(customStart)
            endDate = new Date(customEnd)
            endDate.setHours(23, 59, 59, 999)
        } else {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            switch (period) {
                case "today":
                    startDate = today
                    break
                case "week":
                    // Last 7 days
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 7);
                    startDate.setHours(0, 0, 0, 0);
                    break
                case "month":
                    // Last 30 days
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 30);
                    startDate.setHours(0, 0, 0, 0);
                    break
                case "year":
                    // Last 365 days
                    startDate = new Date(today);
                    startDate.setDate(today.getDate() - 365);
                    startDate.setHours(0, 0, 0, 0);
                    break
                case "all":
                    startDate = new Date(2000, 0, 1) // Effectively all
                    endDate = new Date(2100, 0, 1)
                    break
                default:
                    startDate = today
            }
        }

        // Get all orders (including cancelled) for reporting
        const allOrders = await prisma.order.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            include: { items: true },
            orderBy: { createdAt: "desc" }
        })
        // Get revenue-generating orders (excluding cancelled)
        const revenueOrders = await prisma.order.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                status: { not: "cancelled" }
            },
            include: { items: true }
        })

        // Aggregation for revenue (excluding cancelled orders)
        const paymentStats: Record<string, number> = {}
        const totalRevenue = revenueOrders.reduce((sum, order) => sum + order.totalAmount, 0)
        const totalOrders = allOrders.length
        const completedOrders = allOrders.filter(o => o.status === "completed").length
        const pendingOrders = allOrders.filter(o => o.status === "pending").length
        const cancelledOrders = allOrders.filter(o => o.status === "cancelled").length

        revenueOrders.forEach(order => {
            const method = order.paymentMethod || "cash"
            paymentStats[method] = (paymentStats[method] || 0) + order.totalAmount
        })

        const dailyExpenses = await prisma.dailyExpense.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        })
        const totalOtherExpenses = dailyExpenses.reduce((sum, exp) => {
            const items = Array.isArray(exp.items) ? (exp.items as any[]) : []
            const itemsCost = items.reduce((iSum: number, item: any) => iSum + (item?.amount || 0), 0)
            return sum + (exp.otherExpenses || 0) + itemsCost
        }, 0)

        const operationalExpenses = await prisma.operationalExpense.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        })
        const totalOperationalExpenses = operationalExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)

        // Period-specific stock investment from restock entries.
        const periodStockInvestmentData = await prisma.stockRestockEntry.aggregate({
            where: { date: { gte: startDate, lte: endDate } },
            _sum: { totalPurchaseCost: true }
        })
        const periodStockInvestment = periodStockInvestmentData._sum.totalPurchaseCost || 0

        const totalExpenses = totalOtherExpenses + totalOperationalExpenses + periodStockInvestment
        const periodNetProfit = totalRevenue - totalExpenses

        // 📊 LIFETIME CUMULATIVE METRICS (Stay constant across filters)
        const lifetimeRevenueData = await prisma.order.findMany({
            where: { status: { not: "cancelled" } },
            select: { totalAmount: true }
        })
        const allStock = await prisma.stock.findMany({ select: { totalInvestment: true } })
        const allExpenses = await prisma.dailyExpense.findMany({ select: { otherExpenses: true, items: true } })
        const allOpExpenses = await prisma.operationalExpense.findMany({ select: { amount: true } })

        const lifetimeRevenue = (lifetimeRevenueData as any[]).reduce((sum, order) => sum + (order.totalAmount || 0), 0)
        const lifetimeStockInvestment = (allStock as any[]).reduce((sum, item) => sum + (item.totalInvestment || 0), 0)
        const lifetimeOtherExpenses = (allExpenses as any[]).reduce((sum, exp) => {
            const items = Array.isArray(exp.items) ? exp.items : []
            const itemsCost = items.reduce((iSum: number, item: any) => iSum + (item?.amount || 0), 0)
            return sum + (exp.otherExpenses || 0) + itemsCost
        }, 0)
        const lifetimeOperationalExpenses = (allOpExpenses as any[]).reduce((sum, exp) => sum + (exp.amount || 0), 0)

        const lifetimeTotalInvestment = lifetimeStockInvestment + lifetimeOtherExpenses + lifetimeOperationalExpenses
        const lifetimeNetWorth = lifetimeRevenue - lifetimeTotalInvestment

        return NextResponse.json({
            period,
            startDate,
            endDate,
            summary: {
                totalRevenue,
                totalOrders,
                completedOrders,
                pendingOrders,
                cancelledOrders,
                paymentStats,
                totalOtherExpenses,
                totalOperationalExpenses,
                periodStockInvestment,
                totalExpenses,
                periodNetProfit,
                lifetimeRevenue,
                lifetimeStockInvestment,
                lifetimeOtherExpenses,
                lifetimeOperationalExpenses,
                lifetimeTotalInvestment,
                lifetimeNetWorth
            },
            orders: allOrders,
            revenueOrders,
            dailyExpenses,
            operationalExpenses
        })

    } catch (error: any) {
        console.error("❌ Sales Report Error:", error)
        return NextResponse.json({ message: "Failed to generate report" }, { status: 500 })
    }
}
