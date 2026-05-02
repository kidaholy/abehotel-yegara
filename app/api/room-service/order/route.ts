import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { addNotification } from "@/lib/notifications"
import { calculateStockConsumption } from "@/lib/stock-logic"
import { getSyncedTime } from "@/lib/time-sync"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { items, totalAmount, paymentMethod, customerName, tableNumber, notes } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "Items are required" }, { status: 400 })
    }

    if (!tableNumber) {
      return NextResponse.json({ message: "Room Number is required" }, { status: 400 })
    }

    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json({ message: "Valid total amount is required" }, { status: 400 })
    }

    const stockConsumptionMap = await calculateStockConsumption(items)
    const stockIds = Array.from(stockConsumptionMap.keys())

    const [menuItems, stockItems, roomData] = await Promise.all([
      prisma.menuItem.findMany({
        where: { id: { in: items.map((i: any) => i.menuItemId) } },
        select: {
          id: true,
          menuId: true,
          category: true,
          mainCategory: true,
          preparationTime: true,
          name: true,
        },
      }),
      prisma.stock.findMany({ where: { id: { in: stockIds } } }),
      prisma.room.findUnique({
        where: { roomNumber: tableNumber },
        include: {
          floor: { select: { id: true, roomServiceCashierId: true, floorNumber: true } },
        },
      }),
    ])

    for (const [stockId, requiredAmount] of stockConsumptionMap) {
      const stockItem = stockItems.find(s => s.id === stockId)
      if (stockItem && stockItem.trackQuantity) {
        const availableStock = stockItem.quantity || 0
        if (availableStock <= 0 || availableStock < requiredAmount) {
          return NextResponse.json({
            message: `Insufficient stock: ${stockItem.name}. Required: ${requiredAmount}, Available: ${availableStock}`,
            insufficientStock: stockItem.name
          }, { status: 400 })
        }
      }
    }

    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    const orderCount = await prisma.order.count({ where: { createdAt: { gte: start, lt: end } } })
    let seq = orderCount + 1

    const orderData = {
      items: items.map((item: any) => {
        const menu = (menuItems as any[]).find(m => m.id === item.menuItemId)
        const isDrink = menu?.mainCategory?.toLowerCase() === "drinks"
        return {
          menuItemId: item.menuItemId,
          menuId: menu?.menuId,
          name: item.name || menu?.name || "",
          quantity: Number(item.quantity || 1),
          price: Number(item.price ?? 0),
          category: menu?.category,
          mainCategory: menu?.mainCategory,
          menuTier: 'standard',
          preparationTime: isDrink ? 0 : (menu?.preparationTime || 0),
          status: "unconfirmed",
          modifiers: item.modifiers || [],
          notes: item.notes || ""
        }
      }),
      totalAmount,
      subtotal: totalAmount,
      tax: 0,
      status: "unconfirmed",
      paymentMethod: paymentMethod || "room_bill",
      customerName: customerName || `${tableNumber}`,
      tableNumber,
      floorId: roomData?.floor?.id,
      floorNumber: roomData?.floor?.floorNumber || null,
      createdById: roomData?.floor?.roomServiceCashierId || null,
      notes: notes || "Room Service App Order",
      thresholdMinutes: (() => {
        const foodItems = (menuItems as any[]).filter(m => m.mainCategory?.toLowerCase() !== "drinks")
        if (foodItems.length === 0) return 0
        return Math.max(...foodItems.map(m => m.preparationTime || 10))
      })() || 10,
      createdAt: getSyncedTime()
    }

    let order: any = null

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const orderNumber = String(seq).padStart(3, "0")
        order = await prisma.order.create({
          data: {
            orderNumber,
            totalAmount: Number(orderData.totalAmount || 0),
            subtotal: Number(orderData.subtotal || 0),
            tax: Number(orderData.tax || 0),
            status: "unconfirmed",
            paymentMethod: orderData.paymentMethod,
            customerName: orderData.customerName,
            tableNumber: orderData.tableNumber,
            floorId: orderData.floorId,
            floorNumber: orderData.floorNumber,
            createdById: orderData.createdById,
            thresholdMinutes: orderData.thresholdMinutes,
            createdAt: orderData.createdAt,
            items: {
              create: orderData.items
            }
          },
          include: { items: true }
        })
        break
      } catch (err: any) {
        if (err.code === "P2002") {
          seq++
          continue
        } else {
          throw err
        }
      }
    }

    if (!order) {
      throw new Error("Failed to create order")
    }

    try {
      (async () => {
        try {
          const message = `🔔 Room Service: New Order Request #${order.orderNumber} from Room ${tableNumber} awaits confirmation!`
          const cashierId = roomData?.floor?.roomServiceCashierId
          
          if (cashierId) {
            addNotification("info", message, undefined, cashierId.toString())
          } else {
            addNotification("info", message, "cashier")
          }
        } catch (err) {}
      })()
    } catch (error) {}

    return NextResponse.json({ ...order, _id: order.id }, { status: 201 })
  } catch (error: any) {
    console.error("Room Service Create order error:", error)
    return NextResponse.json({ message: "Failed to create order", error: error.message }, { status: 500 })
  }
}
