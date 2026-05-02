import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    await validateSession(request)

    const { searchParams } = new URL(request.url)
    const menuType = searchParams.get('type') || 'all' 

    let allItems: any[] = []

    const items = await prisma.menuItem.findMany({
      where: { available: true },
      include: {
        recipe: {
          include: { stockItem: true }
        },
        stockItem: true
      }
    })

    if (menuType === 'standard' || menuType === 'all') {
      const standardItems = items.filter((item: any) => item.tier === 'standard')
      allItems = [...allItems, ...standardItems.map((i: any) => ({ ...i, menuType: 'standard' }))]
    }
    if (menuType === 'vip1' || menuType === 'all') {
      const vip1Items = items.filter((item: any) => item.tier === 'vip1')
      allItems = [...allItems, ...vip1Items.map((i: any) => ({ ...i, menuType: 'vip1' }))]
    }
    if (menuType === 'vip2' || menuType === 'all') {
      const vip2Items = items.filter((item: any) => item.tier === 'vip2')
      allItems = [...allItems, ...vip2Items.map((i: any) => ({ ...i, menuType: 'vip2' }))]
    }

    const filteredItems = allItems.filter((item: any) => {
      if (item.stockItem && item.stockItem.status === 'finished') return false
      
      if (item.recipe && item.recipe.length > 0) {
        for (const ingredient of item.recipe) {
          if (ingredient.stockItem && ingredient.stockItem.status === 'finished') return false
        }
      }
      return true
    })

    const serializedItems = filteredItems.map((item: any) => ({
      ...item,
      _id: item.id,
      stockItemId: item.stockItemId || null
    })).sort((a: any, b: any) => {
      const idA = String(a.menuId || "")
      const idB = String(b.menuId || "")
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' })
    })

    return NextResponse.json(serializedItems, {
      headers: {
        'X-Menu-Count': serializedItems.length.toString(),
        'X-VIP1-Count': serializedItems.filter((i: any) => i.menuType === 'vip1').length.toString(),
        'X-VIP2-Count': serializedItems.filter((i: any) => i.menuType === 'vip2').length.toString(),
        'X-Standard-Count': serializedItems.filter((i: any) => i.menuType === 'standard').length.toString(),
      }
    })
  } catch (error: any) {
    console.error("Get menu error:", error)
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to get menu" }, { status })
  }
}
