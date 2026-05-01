import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const decoded = await validateSession(request)

    // Business intelligence analytics
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const [monthOrders, monthExpenses] = await Promise.all([
      prisma.order.findMany({ where: { createdAt: { gte: monthStart } } }),
      prisma.dailyExpense.findMany({ where: { date: { gte: monthStart } } })
    ])

    const monthRevenue = monthOrders
      .filter((o: any) => o.status !== 'cancelled')
      .reduce((sum: number, order: any) => sum + order.totalAmount, 0)

    const monthExpensesTotal = monthExpenses.reduce((sum: number, exp: any) =>
      sum + (exp.otherExpenses || 0), 0)

    const intelligence = {
      monthlyRevenue: monthRevenue,
      monthlyExpenses: monthExpensesTotal,
      profitMargin: monthRevenue > 0 ? ((monthRevenue - monthExpensesTotal) / monthRevenue) * 100 : 0,
      orderTrends: monthOrders.length,
      averageOrderValue: monthOrders.length > 0 ? monthRevenue / monthOrders.length : 0
    }

    return NextResponse.json(intelligence)
  } catch (error: any) {
    console.error("Business intelligence error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}