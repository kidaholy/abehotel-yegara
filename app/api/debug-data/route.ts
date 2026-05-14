import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getStartOfTodayUTC3 } from "@/lib/time-sync"

export async function GET(request: Request) {
  try {
    const todayStart = getStartOfTodayUTC3()
    const rawOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: todayStart }
      },
      orderBy: { createdAt: "desc" }
    })
    
    const explicitAndOrders = await prisma.order.findMany({
      where: {
        AND: [
          { createdAt: { gte: todayStart } },
          { OR: [
            { status: "completed" },
            { status: "preparing" },
            { status: "served" }
          ] }
        ]
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({
      todayStart,
      rawOrdersCount: rawOrders.length,
      explicitAndCount: explicitAndOrders.length
    })
  } catch(e: any) {
    return NextResponse.json({ error: e.message })
  }
}
