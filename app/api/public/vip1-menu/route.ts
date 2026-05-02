import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const items = await prisma.menuItem.findMany({
      where: { tier: 'vip1', available: true },
      include: { stockItem: true }
    })

    const filteredItems = items.filter((item: any) => {
      if (item.stockItem && item.stockItem.status === 'finished') return false
      return true
    })

    const serializedItems = filteredItems.map((item: any) => ({
      ...item,
      _id: item.id,
      mainCategory: item.mainCategory || 'Food',
    })).sort((a: any, b: any) => {
      const idA = String(a.menuId || "")
      const idB = String(b.menuId || "")
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' })
    })

    return NextResponse.json(serializedItems)
  } catch (error: any) {
    console.error("Public VIP1 menu error:", error)
    return NextResponse.json({ message: "Failed to load VIP1 menu" }, { status: 500 })
  }
}
