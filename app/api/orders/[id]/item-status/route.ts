import { NextResponse } from "next/server"
import { connectDB, prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

export async function PATCH(request: Request, context: any) {
  try {
    const [params, decoded] = await Promise.all([
      context.params,
      validateSession(request),
    ])

    if (decoded.role !== 'chef' && decoded.role !== 'bar' && decoded.role !== 'admin') {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    await connectDB()

    const { menuItemId, status } = await request.json()

    if (!menuItemId || !status) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    const orderToUpdate = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    })
    if (!orderToUpdate) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 })
    }

    // Role-based filtering for assigned categories
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { assignedCategories: true },
    })
    const assignedCategories = (user?.assignedCategories || []).map((c: string) => c.trim().normalize("NFC").toLowerCase())

    let itemUpdated = false
    let allItemsReady = true
    let anyItemPreparing = false

    const itemUpdates: any[] = []

    orderToUpdate.items.forEach((item: any) => {
      // Logic for specific item update
      if (item.menuItemId === menuItemId) {
        const itemCat = (item.category || "").trim().normalize("NFC").toLowerCase()
        const isAssigned = assignedCategories.includes(itemCat)
        const isDrinksForBar = decoded.role === 'bar' && item.mainCategory === 'Drinks'

        if (decoded.role === 'admin' || isAssigned || isDrinksForBar) {
          item.status = status
          itemUpdates.push(
            prisma.orderItem.update({
              where: { id: item.id },
              data: { status },
            }),
          )
          itemUpdated = true
        }
      }

      // Progress Tracking
      const isItemDone = ['ready', 'served', 'completed', 'cancelled'].includes(item.status)
      if (!isItemDone) allItemsReady = false
      if (item.status === 'preparing') anyItemPreparing = true
    })

    if (!itemUpdated && decoded.role !== 'admin') {
        return NextResponse.json({ message: "Unauthorized category for this item" }, { status: 403 })
    }

    // Update overall order status based on item progress
    let nextOrderStatus: any = orderToUpdate.status
    if (allItemsReady) {
      nextOrderStatus = orderToUpdate.status === 'completed' ? 'completed' : 'ready'
    } else if (anyItemPreparing) {
      nextOrderStatus = 'preparing'
    }

    await prisma.$transaction([
      ...itemUpdates,
      prisma.order.update({
        where: { id: orderToUpdate.id },
        data: { status: nextOrderStatus },
      }),
    ])

    return NextResponse.json({ ok: true, orderStatus: nextOrderStatus })
  } catch (error: any) {
    console.error("Update item status error:", error)
    return NextResponse.json({ message: "Failed to update item status" }, { status: 500 })
  }
}
