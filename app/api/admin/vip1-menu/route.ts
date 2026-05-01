import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const decoded = await validateSession(request)
    if (decoded.role !== "admin" && decoded.role !== "super-admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const items = await prisma.menuItem.findMany({
      where: { tier: 'vip1' },
      include: { recipe: true }
    })

    const serializedItems = items.map(item => ({
      ...item,
      _id: item.id
    })).sort((a: any, b: any) => {
      const idA = a.menuId || ""
      const idB = b.menuId || ""
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' })
    })

    return NextResponse.json(serializedItems)
  } catch (error: any) {
    console.error("[VIP1] GET error:", error)
    return NextResponse.json({ message: "Failed to get VIP 1 items" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const decoded = await validateSession(request)
    if (decoded.role !== "admin" && decoded.role !== "super-admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const data = await request.json()

    if (!data.name || !data.price) {
      return NextResponse.json({ message: "Name and price are required" }, { status: 400 })
    }

    let finalMenuId = data.menuId ? data.menuId.toString().trim() : ""
    
    // Prefix VIP1_ to ensure uniqueness in Prisma combined @unique clause
    if (finalMenuId && !finalMenuId.startsWith('VIP1_') && !isNaN(parseInt(finalMenuId, 10))) {
        finalMenuId = `VIP1_${finalMenuId}`
    }

    if (!finalMenuId || isNaN(parseInt(finalMenuId.replace('VIP1_', ''), 10))) {
      const allItems = await prisma.menuItem.findMany({ where: { tier: 'vip1' }, select: { menuId: true } })
      let maxId = 0
      allItems.forEach((item: any) => {
        const numStr = item.menuId.replace('VIP1_', '')
        const num = parseInt(numStr, 10)
        if (!isNaN(num) && num > maxId) maxId = num
      })
      finalMenuId = `VIP1_${maxId + 1}`
    }

    const numericId = parseInt(finalMenuId.replace('VIP1_', ''), 10)
    if (!isNaN(numericId)) {
      const allItems = await prisma.menuItem.findMany({ where: { tier: 'vip1' } })
      const itemsToShift = allItems.filter((item: any) => {
        const itemNumericId = parseInt(item.menuId.replace('VIP1_', ''), 10)
        return !isNaN(itemNumericId) && itemNumericId >= numericId
      }).sort((a: any, b: any) => parseInt(b.menuId.replace('VIP1_', ''), 10) - parseInt(a.menuId.replace('VIP1_', ''), 10))

      for (const item of itemsToShift) {
        await prisma.menuItem.update({
          where: { id: item.id },
          data: { menuId: `TEMP_SHIFT_${item.id}_${Date.now()}` }
        })
      }

      for (const item of itemsToShift) {
        const originalNumericId = parseInt(item.menuId.replace('VIP1_', ''), 10)
        await prisma.menuItem.update({
          where: { id: item.id },
          data: { menuId: `VIP1_${originalNumericId + 1}` }
        })
      }
    }

    const createData: any = {
      menuId: finalMenuId,
      tier: 'vip1',
      name: data.name.trim(),
      mainCategory: data.mainCategory || 'Food',
      category: data.category?.trim() || 'VIP 1 Special',
      price: Number(data.price),
      description: data.description?.trim(),
      image: data.image,
      preparationTime: data.preparationTime ? Number(data.preparationTime) : 10,
      available: data.available !== false,
      isVIP: true,
      reportUnit: data.reportUnit || 'piece',
      reportQuantity: data.reportQuantity ? Number(data.reportQuantity) : 0,
      distributions: data.distributions || []
    }

    if (data.recipe && Array.isArray(data.recipe)) {
      createData.recipe = {
        create: data.recipe.map((r: any) => ({
          stockItemId: r.stockItemId,
          stockItemName: r.stockItemName || '',
          quantityRequired: Number(r.quantityRequired),
          unit: r.unit || ''
        }))
      }
    }

    const newItem = await prisma.menuItem.create({ data: createData })

    return NextResponse.json({
      message: "VIP 1 Menu item created successfully",
      item: { ...newItem, _id: newItem.id }
    })
  } catch (error: any) {
    console.error("[VIP1] POST error:", error)
    return NextResponse.json({ message: "Failed to create VIP 1 item" }, { status: 500 })
  }
}
