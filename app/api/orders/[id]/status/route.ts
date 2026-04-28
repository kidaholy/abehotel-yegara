import { NextResponse } from "next/server"
import { connectDB, prisma } from "@/lib/db"
import { addNotification } from "@/lib/notifications"
import { calculateStockConsumption, applyStockAdjustment } from "@/lib/stock-logic"
import { validateSession } from "@/lib/auth"

export async function PUT(request: Request, context: any) {
  return await handleStatusUpdate(request, context)
}

export async function PATCH(request: Request, context: any) {
  return await handleStatusUpdate(request, context)
}

async function handleStatusUpdate(request: Request, context: any) {
  try {
    const [params, decoded] = await Promise.all([
      context.params,
      validateSession(request),
    ])

    await connectDB()

    const { status } = await request.json()

    if (status === "cancelled" && decoded.role !== "admin") {
      return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 })
    }

    const orderToUpdate = await prisma.order.findUnique({
      where: { id: params.id },
      include: { items: true },
    })
    if (!orderToUpdate) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 })
    }

    const previousStatus = orderToUpdate.status

    let updatedItems = orderToUpdate.items
    let updatedOrderStatus: any = status

    if (decoded.role === 'chef' || decoded.role === 'bar') {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { assignedCategories: true },
      })
      const assignedCategories = user?.assignedCategories || []

      let allItemsReady = true
      let anyItemPreparing = false

      const normalizedAssigned = assignedCategories.map((c: string) => c.trim().normalize("NFC").toLowerCase())
      const itemUpdates: { id: string; status: any }[] = []

      updatedItems.forEach((item: any) => {
        const itemCat = (item.category || "").trim().normalize("NFC").toLowerCase()
        const isAssigned = normalizedAssigned.includes(itemCat)
        const isDrinksForBar = decoded.role === 'bar' && item.mainCategory === 'Drinks'

        if (isAssigned || isDrinksForBar) {
          item.status = status
          itemUpdates.push({ id: item.id, status })
        }
        const isItemDone = ['ready', 'served', 'completed', 'cancelled'].includes(item.status)
        if (!isItemDone) allItemsReady = false
        if (item.status === 'preparing') anyItemPreparing = true
      })

      if (status === 'cancelled') {
        // Chef cancelling the whole order — mark everything cancelled
        updatedOrderStatus = 'cancelled'
        updatedItems.forEach((item: any) => {
          item.status = 'cancelled'
          itemUpdates.push({ id: item.id, status: 'cancelled' })
        })
      } else {
        let newOverallStatus = orderToUpdate.status
        if (allItemsReady) {
          newOverallStatus = status === 'completed' ? 'completed' : 'ready'
        } else if (anyItemPreparing || status === 'preparing') {
          newOverallStatus = 'preparing'
        }
        updatedOrderStatus = newOverallStatus
      }

      if (itemUpdates.length > 0) {
        await prisma.$transaction(
          itemUpdates.map((u) =>
            prisma.orderItem.update({
              where: { id: u.id },
              data: { status: u.status },
            }),
          ),
        )
      }
    } else {
      updatedOrderStatus = status
      await prisma.orderItem.updateMany({
        where: { orderId: orderToUpdate.id },
        data: { status },
      })
    }

    if (status === "cancelled" && previousStatus !== "cancelled") {
      const stockConsumptionMap = await calculateStockConsumption(updatedItems)
      await applyStockAdjustment(stockConsumptionMap, 1)
    }

    const now = new Date()
    const orderUpdateData: any = { status: updatedOrderStatus }

    if (status === "preparing" && previousStatus !== "preparing") {
      orderUpdateData.kitchenAcceptedAt = now
    }

    if (status === "ready" && previousStatus !== "ready") {
      orderUpdateData.readyAt = now
    }

    if ((status === "served" || status === "completed") &&
      (previousStatus !== "served" && previousStatus !== "completed")) {

      orderUpdateData.servedAt = now
      const createdAt = new Date(orderToUpdate.createdAt)
      const durationMs = now.getTime() - createdAt.getTime()
      const totalMinutes = Math.floor(durationMs / 60000)

      orderUpdateData.totalPreparationTime = totalMinutes

      let dynamicThreshold = orderToUpdate.thresholdMinutes

      if (!dynamicThreshold) {
        const menuItemIds = updatedItems.map((item: any) => item.menuItemId).filter(Boolean)
        const menuItems = menuItemIds.length
          ? await prisma.menuItem.findMany({
            where: { id: { in: menuItemIds } },
            select: { preparationTime: true },
          })
          : []
        const itemPrepTimes = menuItems.map((mi) => mi.preparationTime || 0)
        const maxPrepTime = itemPrepTimes.length > 0 ? Math.max(...itemPrepTimes) : 0
        const thresholdSetting = await prisma.settings.findUnique({ where: { key: "PREPARATION_TIME_THRESHOLD" } })
        const globalFallback = thresholdSetting ? parseInt(thresholdSetting.value) : 20
        dynamicThreshold = maxPrepTime > 0 ? maxPrepTime : globalFallback
        orderUpdateData.thresholdMinutes = dynamicThreshold
      }

      const excessDelay = Math.max(0, totalMinutes - dynamicThreshold)
      orderUpdateData.delayMinutes = excessDelay
    }

    const saved = await prisma.order.update({
      where: { id: orderToUpdate.id },
      data: orderUpdateData,
      select: { id: true, orderNumber: true, status: true },
    })

    const orderNumber = saved.orderNumber
      ; (async () => {
        try {
          const statusMessages: Record<string, string> = {
            preparing: `Order #${orderNumber} is now being prepared`,
            ready: `Order #${orderNumber} is ready for pickup!`,
            completed: `Order #${orderNumber} has been completed`,
            cancelled: `Order #${orderNumber} has been cancelled by the kitchen`
          }
          if (statusMessages[status]) {
            if (status === "ready" || status === "cancelled") {
              addNotification(status === "ready" ? "success" : "warning", statusMessages[status], "cashier")
            }
            addNotification(status === "cancelled" ? "warning" : "info", statusMessages[status], "admin")
          }
        } catch { /* silent */ }
      })()

    return NextResponse.json({ ok: true, status: saved.status })
  } catch (error: any) {
    console.error("Update order status error:", error)
    return NextResponse.json({ message: "Failed to update order status" }, { status: 500 })
  }
}