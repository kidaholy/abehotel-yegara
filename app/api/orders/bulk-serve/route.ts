import { NextResponse } from "next/server"
import { connectDB, prisma } from "@/lib/db"
import { addNotification } from "@/lib/notifications"
import { validateSession } from "@/lib/auth"

// POST /api/orders/bulk-serve - Mark all active orders as served
export async function POST(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin") {
            return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 })
        }

        await connectDB()

        const now = new Date()

        // Get the global threshold setting
        const thresholdSetting = await prisma.settings.findUnique({ where: { key: "PREPARATION_TIME_THRESHOLD" } })
        const globalFallback = thresholdSetting ? parseInt(thresholdSetting.value) : 20

        // Find all active (non-deleted, non-served, non-cancelled) orders
        const activeOrders = await prisma.order.findMany({
            where: {
                isDeleted: false,
                status: { notIn: ["served", "completed", "cancelled"] },
            },
            include: { items: true },
        })

        if (activeOrders.length === 0) {
            return NextResponse.json({ message: "No active orders to mark as served", servedCount: 0 })
        }

        let servedCount = 0

        const updates: any[] = []

        for (const order of activeOrders) {
            const createdAt = new Date(order.createdAt)
            const durationMs = now.getTime() - createdAt.getTime()
            const totalMinutes = Math.floor(durationMs / 60000)

            let dynamicThreshold = order.thresholdMinutes
            if (!dynamicThreshold) {
                const menuItemIds = order.items.map((i: any) => i.menuItemId).filter(Boolean)
                const menuItems = menuItemIds.length
                    ? await prisma.menuItem.findMany({
                        where: { id: { in: menuItemIds } },
                        select: { preparationTime: true },
                    })
                    : []
                const itemPrepTimes = menuItems.map((mi) => mi.preparationTime || 0)
                const maxPrepTime = itemPrepTimes.length > 0 ? Math.max(...itemPrepTimes) : 0
                dynamicThreshold = maxPrepTime > 0 ? maxPrepTime : globalFallback
            }

            const excessDelay = Math.max(0, totalMinutes - (dynamicThreshold || globalFallback))

            updates.push(
                prisma.order.update({
                    where: { id: order.id },
                    data: {
                        status: "served",
                        servedAt: now,
                        totalPreparationTime: totalMinutes,
                        thresholdMinutes: dynamicThreshold,
                        delayMinutes: excessDelay,
                        items: {
                            updateMany: {
                                where: { orderId: order.id },
                                data: { status: "served" },
                            },
                        },
                    },
                }),
            )

            servedCount++

            addNotification(
                "success",
                `💰 Order #${order.orderNumber} served - Revenue: ${order.totalAmount} Br`,
                "admin"
            )
        }

        await prisma.$transaction(updates)

        addNotification(
            "info",
            `🍽️ Bulk action: ${servedCount} orders marked as served`,
            "cashier"
        )

        return NextResponse.json({
            message: `${servedCount} orders marked as served successfully`,
            servedCount
        })
    } catch (error: any) {
        console.error("❌ Bulk serve error:", error)
        return NextResponse.json({ message: "Failed to mark orders as served" }, { status: 500 })
    }
}
