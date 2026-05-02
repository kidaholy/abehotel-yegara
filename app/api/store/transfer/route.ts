import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

export async function POST(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { stockId, quantity, notes } = await request.json()

        if (!stockId || !quantity || quantity <= 0) {
            return NextResponse.json({ message: "Invalid parameters" }, { status: 400 })
        }

        const stockItem = await prisma.stock.findUnique({ where: { id: stockId } })
        if (!stockItem) {
            return NextResponse.json({ message: "Stock item not found" }, { status: 404 })
        }

        if ((stockItem.storeQuantity || 0) < quantity) {
            return NextResponse.json({
                message: `Insufficient store quantity. Available: ${stockItem.storeQuantity || 0}`
            }, { status: 400 })
        }

        // Perform transfer
        const updatedStock = await prisma.stock.update({
            where: { id: stockId },
            data: {
                storeQuantity: (stockItem.storeQuantity || 0) - quantity,
                quantity: (stockItem.quantity || 0) + quantity,
                status: ((stockItem.quantity || 0) + quantity) > 0 ? "active" : stockItem.status
            }
        })

        // Log transfer
        await prisma.storeLog.create({
            data: {
                stockId: stockItem.id,
                type: 'TRANSFER_OUT',
                quantity: quantity,
                unit: stockItem.unit,
                user: decoded.id,
                notes: notes || "Manual transfer to stock"
            }
        })

        return NextResponse.json({
            message: "Transfer successful",
            stockQuantity: updatedStock.quantity,
            storeQuantity: updatedStock.storeQuantity
        })

    } catch (error: any) {
        console.error("❌ Store transfer error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to transfer item" }, { status })
    }
}
