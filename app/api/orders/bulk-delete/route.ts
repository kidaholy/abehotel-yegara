import { NextResponse } from "next/server"
import { connectDB, prisma } from "@/lib/db"
import { addNotification } from "@/lib/notifications"
import { validateSession } from "@/lib/auth"
import { calculateStockConsumption, applyStockAdjustment } from "@/lib/stock-logic"

export async function DELETE(request: Request) {
  try {
    console.log("🗑️ Bulk deleting all orders...")

    const decoded = await validateSession(request)

    // Only admins can bulk delete orders
    if (decoded.role !== "admin") {
      return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const isPermanent = searchParams.get('permanent') === 'true'

    await connectDB()

    if (isPermanent) {
      // PERMANENT DELETE (Emptying Trash)
      const deletedOrders = await prisma.order.findMany({
        where: { isDeleted: true },
        select: { id: true },
      })
      
      if (deletedOrders.length === 0) {
        return NextResponse.json({ message: "No deleted orders to permanently remove" }, { status: 400 })
      }

      const result = await prisma.order.deleteMany({ where: { isDeleted: true } })

      try {
        addNotification(
          "warning",
          `💥 Admin permanently deleted all records in the Trash (${result.count} orders).`,
          "admin"
        )
      } catch (e) {}

      return NextResponse.json({
        message: `Successfully permanently deleted ${result.count} orders`,
        deletedCount: result.count
      })
    }

    // SOFT DELETE (Moving to History)
    // 🔗 BUSINESS LOGIC: To restore stock correctly, we find all orders that are NOT already cancelled
    // and NOT already deleted
    const activeOrders = await prisma.order.findMany({
      where: { status: { not: "cancelled" }, isDeleted: false },
      include: { items: true },
    })

    const orderCount = await prisma.order.count({ where: { isDeleted: false } })

    if (orderCount === 0 && activeOrders.length === 0) {
      return NextResponse.json({ message: "No active orders to delete" }, { status: 400 })
    }

    // 📡 Restore stock for all active orders before deleting
    if (activeOrders.length > 0) {
      console.log(`📡 Restoring stock for ${activeOrders.length} active orders before bulk deletion...`)
      
      // We process items from all orders together
      const allItems = activeOrders.flatMap(order => order.items || [])
      
      if (allItems.length > 0) {
        const stockConsumptionMap = await calculateStockConsumption(allItems)
        await applyStockAdjustment(stockConsumptionMap, 1) // 1 = Restore
        console.log("✅ Stock restoration completed for bulk deletion")
      }
    }

    // Soft delete all orders
    const result = await prisma.order.updateMany({
      where: { isDeleted: false },
      data: { isDeleted: true, status: "cancelled" },
    })

    // Send notification about bulk deletion
    try {
      addNotification(
        "warning",
        `🗑️ All active orders (${result.count} moved) have been moved to deleted history by admin. Stock has been restored.`,
        "admin"
      )
      console.log(`Bulk deletion notification sent: ${result.count} orders deleted`)
    } catch (error) {
      console.error("Failed to send bulk deletion notification:", error)
    }

    console.log(`✅ Bulk deletion completed: ${result.count} orders moved to history`)
    return NextResponse.json({
      message: `Successfully moved ${result.count} orders to history and restored stock`,
      deletedCount: result.count
    })
  } catch (error: any) {
    console.error("Bulk delete orders error:", error)
    return NextResponse.json({ message: "Failed to delete orders" }, { status: 500 })
  }
}