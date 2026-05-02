import { NextResponse } from "next/server"
import { connectDB, prisma } from "@/lib/db"
import { addNotification } from "@/lib/notifications"
import { calculateStockConsumption, applyStockAdjustment } from "@/lib/stock-logic"
import { validateSession } from "@/lib/auth"

// PUT update order status with automatic stock consumption
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const decoded = await validateSession(request)
        await connectDB()

        const { id } = await params
        const body = await request.json()
        const { status } = body

        if (status === "cancelled" && decoded.role !== "admin") {
            return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 })
        }

        const order = await prisma.order.findUnique({
            where: { id },
            include: { items: true },
        })
        if (!order) {
            return NextResponse.json({ message: "Order not found" }, { status: 404 })
        }

        const previousStatus = order.status

        // Global update (admin/cashier). Fine-grained updates live in /[id]/status and /[id]/item-status.
        // Unified update for items. If this is an approval (status transition to pending), 
        // we auto-complete drinks to streamline room service.
        if (status === "pending") {
            await prisma.orderItem.updateMany({ 
                where: { orderId: id, mainCategory: "Drinks" }, 
                data: { status: "completed" } 
            })
            await prisma.orderItem.updateMany({ 
                where: { orderId: id, mainCategory: { not: "Drinks" } }, 
                data: { status: "pending" } 
            })
        } else {
            await prisma.orderItem.updateMany({ where: { orderId: id }, data: { status } })
        }

        // 🔗 BUSINESS LOGIC: Restore stock if order is cancelled
        if (status === "cancelled" && previousStatus !== "cancelled" && previousStatus !== "unconfirmed") {
            const stockConsumptionMap = await calculateStockConsumption(order.items)
            await applyStockAdjustment(stockConsumptionMap, 1) // 1 = Restore
            console.log(`📡 Restored stock for cancelled order #${order.orderNumber}`)
        }

        // 🔗 BUSINESS LOGIC: Deduct stock when an unconfirmed room order is verified
        if (status === "pending" && previousStatus === "unconfirmed") {
            const stockConsumptionMap = await calculateStockConsumption(order.items)
            await applyStockAdjustment(stockConsumptionMap, -1) // -1 = Deduct
            console.log(`📡 Deducted stock for confirmed room service order #${order.orderNumber}`)
        }

        const now = new Date()
        const updateData: any = { status }

        if (status === "preparing" && previousStatus !== "preparing") {
            updateData.kitchenAcceptedAt = now
        }

        if (status === "ready" && previousStatus !== "ready") {
            updateData.readyAt = now
        }

        if ((status === "served" || status === "completed") &&
            (previousStatus !== "served" && previousStatus !== "completed")) {

            updateData.servedAt = now
            const createdAt = new Date(order.createdAt)
            const durationMs = now.getTime() - createdAt.getTime()
            const totalMinutes = Math.floor(durationMs / 60000)

            updateData.totalPreparationTime = totalMinutes

            // Calculate/Ensure threshold
            let dynamicThreshold = order.thresholdMinutes

            if (!dynamicThreshold) {
                const menuItemIds = order.items.map((item: any) => item.menuItemId).filter(Boolean)
                const menuItems = menuItemIds.length
                    ? await prisma.menuItem.findMany({
                        where: { id: { in: menuItemIds } },
                        select: { preparationTime: true },
                    })
                    : []

                const itemPrepTimes = menuItems.map((mi: any) => mi.preparationTime || 0)
                const maxPrepTime = itemPrepTimes.length > 0 ? Math.max(...itemPrepTimes) : 0

                // Get global fallback from settings (default 20 mins)
                const thresholdSetting = await prisma.settings.findUnique({ where: { key: "PREPARATION_TIME_THRESHOLD" } })
                const globalFallback = thresholdSetting ? parseInt(thresholdSetting.value) : 20

                dynamicThreshold = maxPrepTime > 0 ? maxPrepTime : globalFallback
                updateData.thresholdMinutes = dynamicThreshold
            }

            // Calculate excess delay
            const excessDelay = Math.max(0, totalMinutes - dynamicThreshold)
            updateData.delayMinutes = excessDelay

            console.log(`⏱️ Order #${order.orderNumber} served. Total: ${totalMinutes}m, Target: ${dynamicThreshold}m, Delay: ${excessDelay}m`)

            if (excessDelay > 0) {
                addNotification(
                    "warning",
                    `⚠️ Delay Alert: Order #${order.orderNumber} took ${totalMinutes} minutes to serve! (${excessDelay}m over target of ${dynamicThreshold}m)`,
                    "admin"
                )
            }

            addNotification(
                "success",
                `💰 Order #${order.orderNumber} ${status} - Revenue: ${order.totalAmount} Br`,
                "admin"
            )
        }

        // Refetch order to get latest item statuses (including the ones we just updated via updateMany)
        const currentOrder = await prisma.order.findUnique({
            where: { id },
            include: { items: true }
        })
        
        if (!currentOrder) throw new Error("Order lost during sync")

        const updatedItems = currentOrder.items.map((item: any) => ({
            ...item,
            updatedAt: now.toISOString()
        }));
        updateData.items = updatedItems;

        // If ALL items are now completed (e.g. pure drink order), skip "pending" and go straight to "completed"
        // This prevents "Cooking" label from appearing in Admin for drinks.
        if (status === "pending") {
            const hasPendingItems = updatedItems.some(i => i.status === "pending");
            if (!hasPendingItems) {
                updateData.status = "completed";
            }
        }

        const updatedOrder = await prisma.order.update({
            where: { id },
            data: updateData,
            include: { items: true },
        })

        // Send status update notifications
        if (status !== previousStatus) {
            const statusMessages = {
                pending: "📋 Order is pending preparation",
                preparing: "👨‍🍳 Order is being prepared",
                ready: "🔔 Order is ready for pickup",
                served: "🍽️ Order has been served to table",
                completed: "✅ Order has been completed"
            }

            addNotification(
                "info",
                `${statusMessages[status as keyof typeof statusMessages]} - Order #${order.orderNumber}`,
                (status === "ready" || status === "served") ? "cashier" : "chef"
            )
        }

        const serializedOrder = {
            ...updatedOrder,
            _id: updatedOrder.id
        }

        return NextResponse.json(serializedOrder)
    } catch (error: any) {
        console.error("❌ Update order error:", error)
        return NextResponse.json({ message: "Failed to update order" }, { status: 500 })
    }
}

// DELETE order
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }
        await connectDB()

        const { id } = await params

        const orderToDelete = await prisma.order.findUnique({
            where: { id },
            include: { items: true },
        })
        if (!orderToDelete) {
            return NextResponse.json({ message: "Order not found" }, { status: 404 })
        }

        // 🔗 BUSINESS LOGIC: Restore stock on deletion if the order was not already cancelled/unconfirmed
        const status = orderToDelete.status
        if (status !== 'cancelled' && status !== 'unconfirmed') {
            const stockConsumptionMap = await calculateStockConsumption(orderToDelete.items)
            await applyStockAdjustment(stockConsumptionMap, 1) // 1 = Restore
            console.log(`📡 Restored stock for deleted order #${orderToDelete.orderNumber}`)
        }

        await prisma.order.update({ where: { id }, data: { isDeleted: true, status: "cancelled" } })

        // Send cancellation notification
        addNotification(
            "info",
            `🗑️ Order #${orderToDelete.orderNumber} has been moved to deleted history`,
            "admin"
        )

        return NextResponse.json({ message: "Order moved to history successfully" })
    } catch (error: any) {
        console.error("❌ Delete order error:", error)
        return NextResponse.json({ message: "Failed to delete order" }, { status: 500 })
    }
}