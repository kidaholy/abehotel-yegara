import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const items = await prisma.menuItem.findMany({
      where: { tier: 'standard', available: true },
      include: { stockItem: true }
    })

    const filteredItems = items.filter((item: any) => {
      if (item.stockItem && item.stockItem.status === 'finished') return false
      return true
    })

    const serializedItems = filteredItems.map((item: any) => ({
      _id: item.id,
      menuId: item.menuId,
      name: item.name,
      mainCategory: item.mainCategory || 'Food',
      category: item.category,
      price: item.price,
      description: item.description,
      image: item.image,
      preparationTime: item.preparationTime,
    })).sort((a: any, b: any) => {
      const idA = a.menuId || ""
      const idB = b.menuId || ""
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' })
    })

    return NextResponse.json(serializedItems)
  } catch (error: any) {
    console.error("Public menu error:", error)
    return NextResponse.json({ message: "Failed to load menu" }, { status: 500 })
  }
}
