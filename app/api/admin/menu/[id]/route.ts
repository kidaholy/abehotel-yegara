import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

// =============================================================================
// STANDARD MENU ITEM — Update & Delete ONLY from `menuitems`
// =============================================================================

export async function PUT(request: Request, context: any) {
  try {
    const { id } = await context.params

    const decoded = await validateSession(request)
    if (decoded.role !== "admin" && decoded.role !== "super-admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const data = await request.json()

    console.log(`[STANDARD] PUT request for _id: ${id} in menuitems`)

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

    // Recipe relation logic safely translated from Mongo schema to Prisma associations
    if (data.recipe && Array.isArray(data.recipe)) {
      updatePayload.recipe = {
        deleteMany: {}, // Clear previous items
        create: data.recipe.map((r: any) => ({
          stockItemId: r.stockItemId,
          stockItemName: r.stockItemName || '',
          quantityRequired: Number(r.quantityRequired),
          unit: r.unit || ''
        }))
      }
    }

    // Remove undefined fields so Prisma doesn't overwrite with nulls inappropriately
    Object.keys(updatePayload).forEach(k => updatePayload[k] === undefined && delete updatePayload[k])

    try {
      const menuItem = await prisma.menuItem.update({
        where: { id },
        data: updatePayload,
        include: { recipe: true }
      })

      console.log(`[STANDARD] Successfully updated _id: ${id} in menuitems`)
      return NextResponse.json({
        message: "Menu item updated successfully",
        menuItem: { ...menuItem, _id: menuItem.id }
      })
    } catch (dbError: any) {
      if (dbError.code === 'P2025') {
        console.error(`[STANDARD] _id ${id} NOT found in menuitems`)
        return NextResponse.json({ message: "Menu item not found in Standard collection" }, { status: 404 })
      }
      throw dbError
    }

  } catch (error: any) {
    console.error("[STANDARD] PUT error:", error)
    return NextResponse.json({ message: "Failed to update menu item" }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const { id } = await context.params

    const decoded = await validateSession(request)
    if (decoded.role !== "admin" && decoded.role !== "super-admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    console.log(`[STANDARD] DELETE request for _id: ${id} in menuitems`)

    try {
      await prisma.menuItem.delete({
        where: { id }
      })

      console.log(`[STANDARD] Successfully deleted _id: ${id} from menuitems`)
      return NextResponse.json({ message: "Menu item deleted successfully" })
    } catch (dbError: any) {
      if (dbError.code === 'P2025') {
        return NextResponse.json({ message: "Menu item not found in Standard collection" }, { status: 404 })
      }
      throw dbError
    }

  } catch (error: any) {
    console.error("[STANDARD] DELETE error:", error)
    return NextResponse.json({ message: "Failed to delete menu item" }, { status: 500 })
  }
}