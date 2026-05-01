import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const date = searchParams.get("date")
        const period = searchParams.get("period") || "today"

        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
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
            }
            query.date = { gte: startDate, lte: endDate }
        }

        const expenses = await prisma.dailyExpense.findMany({
            where: query,
            orderBy: { date: 'desc' }
        })

        const serializedExpenses = expenses.map(expense => ({
            ...expense,
            _id: expense.id
        }))

        return NextResponse.json(serializedExpenses)
    } catch (error: any) {
        console.error("❌ Get expenses error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to get expenses" }, { status })
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        if (!id) {
            return NextResponse.json({ message: "Expense ID is required" }, { status: 400 })
        }

        try {
            await prisma.dailyExpense.delete({ where: { id } })
            return NextResponse.json({ message: "Expense deleted successfully" })
        } catch (error: any) {
            if (error.code === 'P2025') return NextResponse.json({ message: "Expense not found" }, { status: 404 })
            throw error
        }
    } catch (error: any) {
        console.error("❌ Delete expense error:", error)
        return NextResponse.json({ message: "Failed to delete expense" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { date, otherExpenses, items, description } = body

        if (!date) {
            return NextResponse.json({ message: "Date is required" }, { status: 400 })
        }

        const expenseDate = new Date(date)
        expenseDate.setUTCHours(0, 0, 0, 0)
        
        // Target an explicit range for existing expense on that date
        const endDate = new Date(expenseDate)
        endDate.setUTCHours(23, 59, 59, 999)

        const existingExpenses = await prisma.dailyExpense.findMany({ 
            where: { date: { gte: expenseDate, lte: endDate } } 
        })
        const existingExpense = existingExpenses.length > 0 ? existingExpenses[0] : null

        const expenseData = {
            date: expenseDate,
            otherExpenses: typeof otherExpenses === 'number' ? otherExpenses : 0,
            items: items || [],
            description: description || ""
        }

        let expense
        if (existingExpense) {
            expense = await prisma.dailyExpense.update({
                where: { id: existingExpense.id },
                data: expenseData
            })
        } else {
            expense = await prisma.dailyExpense.create({
                data: expenseData
            })
        }

        if (items && items.length > 0) {
            for (const item of items) {
                if (item.quantity > 0 && item.name) {
                    await prisma.stock.updateMany({
                        where: { name: { startsWith: item.name, mode: 'insensitive' } },
                        data: { quantity: { increment: item.quantity } }
                    })
                }
            }
        }

        const serializedExpense = {
            ...expense,
            _id: expense.id
        }

        return NextResponse.json(serializedExpense, { status: existingExpense ? 200 : 201 })
    } catch (error: any) {
        console.error("❌ Create/Update expense error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to save expense" }, { status })
    }
}