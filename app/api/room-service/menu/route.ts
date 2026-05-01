import { NextResponse } from "next/server"
import { MenuTier } from "@prisma/client"
import { prisma } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const roomNumber = searchParams.get("roomNumber")

    let menuTier: MenuTier = "standard"

    if (roomNumber) {
        const room = await prisma.room.findUnique({
          where: { roomNumber },
          select: { roomServiceMenuTier: true }
        })
        if (room) {
            menuTier = room.roomServiceMenuTier || "standard"
        }
    }

    const items = await prisma.menuItem.findMany({
      where: {
        available: true,
        tier: menuTier
      }
    })
    
    const serializedItems = items.map((item: any) => ({
      ...item,
      _id: item.id
    })).sort((a: any, b: any) => {
      const idA = a.menuId || ""
      const idB = b.menuId || ""
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' })
    })

    return NextResponse.json(serializedItems)
  } catch (error: any) {
    console.error("❌ Room Service Get menu items error:", error)
    return NextResponse.json({ message: "Failed to get menu items" }, { status: 500 })
  }
}
