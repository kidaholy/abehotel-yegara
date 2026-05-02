import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

// GET stock health & movement report
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const format = searchParams.get("format") || "json"
        const period = searchParams.get("period") || "month"
        const categoryFilter = searchParams.get("category")

        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        // Calculate date range
        const now = new Date()
        let startDate = new Date()
        switch (period) {
            case "today": startDate.setHours(0, 0, 0, 0); break
            case "week": startDate.setDate(now.getDate() - 7); break
            case "month": startDate.setMonth(now.getMonth() - 1); break
            case "year": startDate.setFullYear(now.getFullYear() - 1); break
            case "all": startDate = new Date(2000, 0, 1); break
            default: startDate.setMonth(now.getMonth() - 1)
        }

        const where: any = {}
        if (categoryFilter) where.category = categoryFilter

        const stockItems = await prisma.stock.findMany({
            where,
            include: { restockHistory: true },
            orderBy: { name: "asc" }
        })

        const reportData = stockItems.map(item => {
            const periodRestocks = (item.restockHistory || []).filter((r: any) => new Date(r.date) >= startDate)
            const periodRestockVolume = periodRestocks.reduce((sum: number, r: any) => sum + (r.quantityAdded || 0), 0)
            const periodRestockCost = periodRestocks.reduce((sum: number, r: any) => sum + (r.totalPurchaseCost || 0), 0)

            return {
                name: item.name,
                category: item.category,
                unit: item.unit,
                currentBalance: item.quantity || 0,
                storeQuantity: item.storeQuantity || 0,
                unitCost: item.unitCost || 0,
                totalValue: (item.quantity || 0) * (item.unitCost || 0),
                status: item.status,
                minLimit: item.minLimit || 0,
                periodRestockVolume,
                periodRestockCost,
                isLowStock: item.trackQuantity && (item.quantity || 0) <= (item.minLimit || 0),
                isOutOfStock: item.trackQuantity && (item.quantity || 0) <= 0,
                lastRestockDate: item.restockHistory?.length > 0 ? item.restockHistory[item.restockHistory.length - 1].date : null,
                lastRestockAmount: item.restockHistory?.length > 0 ? item.restockHistory[item.restockHistory.length - 1].quantityAdded : 0,
            }
        })

        const summary = {
            totalItems: reportData.length,
            totalValue: reportData.reduce((sum, i) => sum + i.totalValue, 0),
            lowStockItems: reportData.filter(i => i.isLowStock).length,
            outOfStockItems: reportData.filter(i => i.isOutOfStock).length,
            periodRestockCost: reportData.reduce((sum, i) => sum + i.periodRestockCost, 0),
            reportPeriod: period
        }

        if (format === "csv") {
            const headers = ["Name", "Category", "Current", "Store", "UnitCost", "TotalValue", "Status", "LowStock"]
            const rows = reportData.map(i => [i.name, i.category, i.currentBalance, i.storeQuantity, i.unitCost, i.totalValue, i.status, i.isLowStock ? "Yes" : "No"])
            const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
            return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="stock-report.csv"` } })
        }

        return NextResponse.json({ summary, items: reportData })
    } catch (error: any) {
        console.error("❌ Stock report error:", error)
        return NextResponse.json({ message: "Failed to generate report" }, { status: 500 })
    }
}