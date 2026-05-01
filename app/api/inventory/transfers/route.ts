import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"
import { addNotification } from "@/lib/notifications"

export async function GET(request: Request) {
    try {
        const user = await validateSession(request)

        const { searchParams } = new URL(request.url)
        const status = searchParams.get("status")

        const query: any = {}
        if (status) query.status = status
        if (user.role === 'store_keeper') {
            query.requestedById = user.id
        }

        const requests = await prisma.transferRequest.findMany({
            where: query,
            include: {
                stock: { select: { name: true, unit: true, unitType: true, storeQuantity: true, quantity: true } },
                requestedBy: { select: { name: true } },
                handledBy: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        })
        
        const serializedRequests = requests.map(r => ({
            ...r,
            _id: r.id,
            stockId: r.stock,
            requestedBy: r.requestedBy,
            handledBy: r.handledBy
        }))

        return NextResponse.json(serializedRequests)
    } catch (error: any) {
        return NextResponse.json({ message: error.message }, { status: error.message.includes("Unauthorized") ? 401 : 500 })
    }
}

export async function POST(request: Request) {
    try {
        const user = await validateSession(request)
        if (user.role !== 'admin' && user.role !== 'store_keeper') {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { stockId, quantity, notes } = await request.json()
        if (!stockId || !quantity || quantity <= 0) {
            return NextResponse.json({ message: "Invalid stock ID or quantity" }, { status: 400 })
        }

        const stockItem = await prisma.stock.findUnique({ where: { id: stockId } })
        if (!stockItem) {
            return NextResponse.json({ message: "Stock item not found" }, { status: 404 })
        }

        if (stockItem.storeQuantity < quantity) {
            return NextResponse.json({ message: `Insufficient store quantity. Available: ${stockItem.storeQuantity}` }, { status: 400 })
        }

        const transferRequest = await prisma.transferRequest.create({
            data: {
                stockId,
                quantity: Number(quantity),
                notes: notes || "",
                requestedById: user.id,
                status: 'pending'
            }
        })

        addNotification(
            "info",
            `New Transfer Request: ${quantity} units of ${stockItem.name} requested by ${user.name}`,
            "admin"
        )

        return NextResponse.json({ ...transferRequest, _id: transferRequest.id }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ message: error.message }, { status: error.message.includes("Unauthorized") ? 401 : 500 })
    }
}
