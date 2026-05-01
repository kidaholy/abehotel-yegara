import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function PUT(request: Request, context: any) {
  try {
    const { id } = await context.params
    const decoded = await validateSession(request)
    if (decoded.role !== "admin" && decoded.role !== "super-admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const data = await request.json()

    const updatePayload: any = {
      name: data.name?.trim(),
      category: data.category?.trim(),
      description: data.description?.trim(),
      image: data.image,
      reportUnit: data.reportUnit,
      distributions: data.distributions,
      stockItemId: data.stockItemId === "" ? null : data.stockItemId
    }

    if (data.mainCategory !== undefined) updatePayload.mainCategory = data.mainCategory as any
    if (data.price !== undefined) updatePayload.price = Number(data.price)
    if (data.preparationTime !== undefined) updatePayload.preparationTime = Number(data.preparationTime)
    if (data.available !== undefined) updatePayload.available = data.available
    if (data.reportQuantity !== undefined) updatePayload.reportQuantity = Number(data.reportQuantity)

    if (data.recipe && Array.isArray(data.recipe)) {
      updatePayload.recipe = {
        deleteMany: {}, 
        create: data.recipe.map((r: any) => ({
          stockItemId: r.stockItemId,
          stockItemName: r.stockItemName || '',
          quantityRequired: Number(r.quantityRequired),
          unit: r.unit || ''
        }))
      }
    }

    Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k])

    try {
      const updated = await prisma.menuItem.update({
        where: { id },
        data: updatePayload,
        include: { recipe: true }
      })
      return NextResponse.json({ message: "VIP 1 Menu item updated successfully", item: { ...updated, _id: updated.id } })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: "Item not found in compilation" }, { status: 404 })
      }
      throw error
    }
  } catch (error: any) {
    console.error("[VIP1] PUT error:", error)
    return NextResponse.json({ message: "Failed to update VIP 1 item" }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const { id } = await context.params
    const decoded = await validateSession(request)
    if (decoded.role !== "admin" && decoded.role !== "super-admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    try {
      await prisma.menuItem.delete({ where: { id } })
      return NextResponse.json({ message: "VIP 1 Menu item deleted successfully" })
    } catch (error: any) {
      if (error.code === 'P2025') {
        return NextResponse.json({ message: "Item not found" }, { status: 404 })
      }
      throw error
    }
  } catch (error: any) {
    console.error("[VIP1] DELETE error:", error)
    return NextResponse.json({ message: "Failed to delete VIP 1 item" }, { status: 500 })
  }
}
