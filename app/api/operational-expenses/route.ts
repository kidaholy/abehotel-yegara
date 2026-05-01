import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const date = searchParams.get("date")
        const period = searchParams.get("period") || "month"

        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin" && decoded.role !== "store_keeper" && !(decoded.role === "custom" && decoded.permissions?.includes("store:view"))) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        let query: any = {}
        if (date) {
            const targetDate = new Date(date)
            targetDate.setUTCHours(0, 0, 0, 0)
            query.date = targetDate
        } else if (period !== "all") {
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

        const expenses = await prisma.operationalExpense.findMany({
            where: query,
            orderBy: { date: 'desc' }
        })
        const serializedExpenses = expenses.map(e => ({ ...e, _id: e.id }))
        return NextResponse.json(serializedExpenses)
    } catch (error: any) {
        console.error("❌ Get operational expenses error:", error)
        return NextResponse.json({ message: "Failed to get expenses" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin" && !(decoded.role === "custom" && decoded.permissions?.includes("store:create"))) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { _id, date, category, amount, description, name } = body

        if (!date || !category || amount === undefined) {
            return NextResponse.json({ message: "Date, category, and amount are required" }, { status: 400 })
        }

        const expenseData = {
            date: new Date(date),
            name: name || "",
            category,
            amount: Number(amount),
            description: description || ""
        }

        let expense
        if (_id) {
            expense = await prisma.operationalExpense.update({
                where: { id: _id },
                data: expenseData
            })
        } else {
            expense = await prisma.operationalExpense.create({
                data: expenseData
            })
        }

        return NextResponse.json({ ...expense, _id: expense.id }, { status: _id ? 200 : 201 })
    } catch (error: any) {
        console.error("❌ Save operational expense error:", error)
        return NextResponse.json({ message: "Failed to save expense" }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin" && !(decoded.role === "custom" && decoded.permissions?.includes("store:delete"))) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        if (!id) {
            return NextResponse.json({ message: "Expense ID is required" }, { status: 400 })
        }

        try {
            await prisma.operationalExpense.delete({ where: { id } })
            return NextResponse.json({ message: "Expense deleted successfully" })
        } catch (error: any) {
            if (error.code === 'P2025') return NextResponse.json({ message: "Expense not found" }, { status: 404 })
            throw error
        }
    } catch (error: any) {
        console.error("❌ Delete operational expense error:", error)
        return NextResponse.json({ message: "Failed to delete expense" }, { status: 500 })
    }
}
