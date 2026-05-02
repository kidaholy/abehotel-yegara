import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const decoded = await validateSession(request)
    if (decoded.role !== "admin" && decoded.role !== "super-admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const allItems = await prisma.menuItem.findMany({
      where: { tier: 'vip1' },
      include: { stockItem: true }
    })
    
    const serializedItems = allItems.map((item: any) => ({
      ...item,
      _id: item.id,
      stockItemId: item.stockItem ? { ...item.stockItem, _id: item.stockItemId } : item.stockItemId
    })).sort((a: any, b: any) => {
      const idA = String(a.menuId || "")
      const idB = String(b.menuId || "")
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' })
    })

    return NextResponse.json(serializedItems)
  } catch (error: any) {
    console.error("❌ Get menu items error:", error)
    return NextResponse.json({ message: "Failed to get menu items" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const decoded = await validateSession(request)
    if (decoded.role !== "admin" && decoded.role !== "super-admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const { menuId, name, mainCategory, category, price, description, image, preparationTime, available, stockItemId, stockConsumption, isVIP, tier } = await request.json()

    if (!name || !price) {
      return NextResponse.json({ message: "Name and price are required" }, { status: 400 })
    }

    let finalMenuId = menuId ? menuId.toString().trim() : ""
    if (!finalMenuId) {
      const allItems = await prisma.menuItem.findMany()
      let maxId = 0
      allItems.forEach((item: any) => {
        if (item.menuId) {
          const match = item.menuId.match(/\d+/)
          if (match) {
            const num = parseInt(match[0], 10)
            if (num > maxId) maxId = num
          }
        }
      })
      finalMenuId = (maxId + 1).toString()
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        menuId: finalMenuId,
        name: name.trim(),
        mainCategory: mainCategory || 'Food',
        category: category ? category.trim() : undefined,
        price: Number(price),
        description,
        image,
        preparationTime: preparationTime ? Number(preparationTime) : 10,
        available: available !== false,
        stockItemId: stockItemId || null,
        stockConsumption: stockConsumption ? Number(stockConsumption) : 0,
        isVIP: true,
        tier: 'vip1'
      }
    })

    return NextResponse.json({
      message: "Menu item created successfully",
      menuItem: { ...menuItem, _id: menuItem.id }
    })
  } catch (error: any) {
    console.error("❌ Create menu item error:", error)
    return NextResponse.json({ message: "Failed to create menu item" }, { status: 500 })
  }
}