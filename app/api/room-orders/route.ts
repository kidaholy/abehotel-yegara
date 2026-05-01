import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const decoded = await validateSession(request)
    if (decoded.role !== 'cashier' && decoded.role !== 'admin' && decoded.role !== 'super-admin') {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    let where: any = { status: "unconfirmed", isDeleted: false }
    
    // If cashier, only fetch orders where floor.roomServiceCashierId matches their ID
    if (decoded.role === 'cashier') {
      const assignedFloors = await prisma.floor.findMany({
        where: { roomServiceCashierId: decoded.id },
        select: { id: true }
      })
      const floorIds = assignedFloors.map((f) => f.id)
      where = { ...where, floorId: { in: floorIds } }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        floor: { select: { floorNumber: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    const serialized = orders.map((o: any) => {
      const floorNumber = o.floorNumber || o.floor?.floorNumber || ""
      return { 
        ...o, 
        _id: o.id,
        floorNumber
      }
    })
    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error("❌ Get room orders error:", error)
    return NextResponse.json({ message: "Failed to get room orders" }, { status: 500 })
  }
}
