import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const date = searchParams.get("date")
        const period = searchParams.get("period") || "month"

        const decoded = await validateSession(request)
        if (!["admin", "super-admin", "store_keeper"].includes(decoded.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        let query: any = {}

        if (date) {
            const targetDate = new Date(date)
            targetDate.setUTCHours(0, 0, 0, 0)
            const endDate = new Date(targetDate)
            endDate.setUTCHours(23, 59, 59, 999)
            query.date = { gte: targetDate, lte: endDate }
        } else {
            const now = new Date()
            let startDate = new Date()
            let endDate = new Date()

            switch (period) {
                case "today":
                    startDate.setUTCHours(0, 0, 0, 0)
                    endDate.setUTCHours(23, 59, 59, 999)
                    break
                case "week":
                    const day = now.getDay()
                    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
                    startDate = new Date(now.setDate(diff))
                    startDate.setUTCHours(0, 0, 0, 0)
                    endDate = new Date()
                    endDate.setUTCHours(23, 59, 59, 999)
                    break
                case "month":
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
                    break
                case "year":
                    startDate = new Date(now.getFullYear(), 0, 1)
                    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
                    break
                case "all":
                    startDate = new Date(2000, 0, 1)
                    endDate = new Date(2100, 0, 1)
                    break
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
                    break
            }

            if (period !== "all") {
                query.date = { gte: startDate, lte: endDate }
            }
        }

        const expenses = await prisma.dailyExpense.findMany({
            where: query,
            orderBy: { date: 'desc' }
        })

        const serializedExpenses = expenses.map(e => ({ ...e, _id: e.id }))
        return NextResponse.json(serializedExpenses)
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to get expenses" }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        const decoded = await validateSession(request)
        if (!["admin", "super-admin"].includes(decoded.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        if (!id) return NextResponse.json({ message: "Expense ID is required" }, { status: 400 })

        try {
            await prisma.dailyExpense.delete({ where: { id } })
            return NextResponse.json({ message: "Expense deleted successfully" })
        } catch (error: any) {
            return NextResponse.json({ message: "Expense not found" }, { status: 404 })
        }
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to delete expense" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (!["admin", "super-admin"].includes(decoded.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { date, otherExpenses, items, description } = body

        if (!date) return NextResponse.json({ message: "Date is required" }, { status: 400 })

        const expenseDate = new Date(date)
        expenseDate.setUTCHours(0, 0, 0, 0)
        const nextDay = new Date(expenseDate)
        nextDay.setUTCHours(23, 59, 59, 999)

        const calculatedOtherExpenses = (items || []).reduce((sum: number, item: any) => sum + (item.amount || 0), 0)

        const expenseData = {
            date: expenseDate,
            otherExpenses: calculatedOtherExpenses,
            items: items || [],
            description: description || ""
        }

        const existingExpenses = await prisma.dailyExpense.findMany({
            where: { date: { gte: expenseDate, lte: nextDay } }
        })
        const existingExpense = existingExpenses.length > 0 ? existingExpenses[0] : null

        let expense
        if (existingExpense) {
            let parsedItems = []
            if (typeof existingExpense.items === 'string') {
                try { parsedItems = JSON.parse(existingExpense.items as string) } catch {}
            } else if (Array.isArray(existingExpense.items)) parsedItems = existingExpense.items
            
            for (const item of parsedItems) {
                if (item.quantity > 0) {
                    const stockItems = await prisma.stock.findMany({
                        where: { name: { equals: item.name, mode: 'insensitive' }, status: { not: 'finished' } }
                    })
                    if (stockItems.length > 0) {
                        await prisma.stock.update({
                            where: { id: stockItems[0].id },
                            data: { storeQuantity: Math.max(0, (stockItems[0].storeQuantity || 0) - item.quantity) }
                        })
                    }
                }
            }
            
            expense = await prisma.dailyExpense.update({
                where: { id: existingExpense.id },
                data: expenseData
            })
        } else {
            expense = await prisma.dailyExpense.create({ data: expenseData })
        }

        if (items && items.length > 0) {
            for (const item of items) {
                if (item.quantity > 0 && item.name) {
                    const unitCost = item.quantity > 0 ? (item.amount / item.quantity) : 0
                    const stockItems = await prisma.stock.findMany({
                        where: { name: { equals: item.name, mode: 'insensitive' }, status: { not: 'finished' } }
                    })

                    if (stockItems.length > 0) {
                        const stockItem = stockItems[0]
                        const totalPurchased = (stockItem.totalPurchased || 0) + item.quantity
                        const totalInvestment = (stockItem.totalInvestment || 0) + item.amount
                        const avg = totalPurchased > 0 ? totalInvestment / totalPurchased : 0
                        await prisma.stock.update({
                            where: { id: stockItem.id },
                            data: {
                                storeQuantity: (stockItem.storeQuantity || 0) + item.quantity,
                                totalPurchased,
                                totalInvestment,
                                averagePurchasePrice: avg,
                                unitCost
                            }
                        })
                        await prisma.storeLog.create({
                            data: {
                                stockId: stockItem.id,
                                type: 'PURCHASE',
                                quantity: item.quantity,
                                unit: item.unit || 'pcs',
                                pricePerUnit: unitCost,
                                totalPrice: item.amount,
                                userId: decoded.id,
                                notes: `Purchased via Expense on ${expenseDate.toLocaleDateString()}`
                            }
                        })
                    } else {
                        const unit = (item.unit || 'pcs').toLowerCase()
                        let unitType = 'count'
                        if (['kg', 'g', 'gram', 'kilogram'].includes(unit)) {
                            unitType = 'weight'
                        } else if (['l', 'ml', 'liter', 'litre', 'milliliter'].includes(unit)) {
                            unitType = 'volume'
                        }
                        const newStock = await prisma.stock.create({
                            data: {
                                name: item.name,
                                category: 'supplies',
                                quantity: 0,
                                storeQuantity: item.quantity,
                                unit: item.unit || 'pcs',
                                unitType,
                                minLimit: 0,
                                averagePurchasePrice: unitCost,
                                unitCost,
                                trackQuantity: true,
                                showStatus: true,
                                status: 'active',
                                totalPurchased: item.quantity,
                                totalConsumed: 0,
                                totalInvestment: item.amount || 0
                            }
                        })
                        await prisma.storeLog.create({
                            data: {
                                stockId: newStock.id,
                                type: 'PURCHASE',
                                quantity: item.quantity,
                                unit: item.unit || 'pcs',
                                pricePerUnit: unitCost,
                                totalPrice: item.amount,
                                userId: decoded.id,
                                notes: `Initial purchase via Expense on ${expenseDate.toLocaleDateString()}`
                            }
                        })
                    }
                }
            }
        }

        return NextResponse.json({ ...expense, _id: expense.id }, { status: existingExpense ? 200 : 201 })
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to save expense" }, { status: 500 })
    }
}