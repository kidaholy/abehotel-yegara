import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getStartOfTodayUTC3 } from "@/lib/time-sync"

export async function GET(request: Request) {
  try {
    const start = new Date("2026-05-12T21:00:00.000Z")
    const end = new Date("2026-05-13T20:59:59.999Z")

    // Test 1: Literal explicit where
    const explicitOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end }
      }
    })

    // Test 2: Literal explicit where inside AND
    const andOrders = await prisma.order.findMany({
      where: {
        AND: [ { createdAt: { gte: start, lte: end } } ]
      }
    })

    const baseWhere: any = {}
    baseWhere.createdAt = { gte: start, lte: end }

    // Test 3: Constructed where
    const constructedOrders = await prisma.order.findMany({
      where: { AND: [ baseWhere ] }
    })

    // Let's get the stringified URL
    return NextResponse.json({
        explicitCount: explicitOrders.length,
        andCount: andOrders.length,
        constructedCount: constructedOrders.length,
        totalOrders: await prisma.order.count()
    })
  } catch(e: any) {
    return NextResponse.json({ error: e.message })
  }
}
