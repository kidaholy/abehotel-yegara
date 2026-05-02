import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"
import { addNotification } from "@/lib/notifications"

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await validateSession(request)
        if (user.role !== 'admin') {
            return NextResponse.json({ message: "Only admins can approve transfers" }, { status: 403 })
        }

        const { id } = await params
        const { action, denialReason } = await request.json()

        if (!['approved', 'denied'].includes(action)) {
            return NextResponse.json({ message: "Invalid action" }, { status: 400 })
        }

        const transferReq = await prisma.transferRequest.findUnique({ where: { id } })
        if (!transferReq) {
            return NextResponse.json({ message: "Transfer request not found" }, { status: 404 })
        }

        if (transferReq.status !== 'pending') {
            return NextResponse.json({ message: "Request already handled" }, { status: 400 })
        }

        if (action === 'denied') {
            const updatedReq = await prisma.transferRequest.update({
                where: { id },
                data: {
                    status: 'denied',
                    denialReason,
                    handledById: user.id
                }
            })

            addNotification(
                "error",
                `Transfer Request for ${updatedReq.quantity} units was denied. Reason: ${denialReason || 'No reason provided'}`,
                undefined,
                updatedReq.requestedById
            )

            return NextResponse.json(updatedReq)
        }

        // Approval Flow - MUST BE ATOMIC
        try {
            const result = await prisma.$transaction(async (tx: any) => {
                const stockItem = await tx.stock.findUnique({ where: { id: transferReq.stockId } })
                if (!stockItem) {
                    throw new Error("Stock item not found")
                }

                if (stockItem.storeQuantity < transferReq.quantity) {
                    throw new Error(`Insufficient store quantity. Current: ${stockItem.storeQuantity}`)
                }

                // Perform moves
                await tx.stock.update({
                    where: { id: stockItem.id },
                    data: {
                        storeQuantity: Number(stockItem.storeQuantity || 0) - Number(transferReq.quantity || 0),
                        quantity: Number(stockItem.quantity || 0) + Number(transferReq.quantity || 0)
                    }
                })

                // Log the transfer
                await tx.storeLog.create({
                    data: {
                        stockId: transferReq.stockId,
                        type: 'TRANSFER_OUT',
                        quantity: transferReq.quantity,
                        unit: stockItem.unit,
                        userId: user.id,
                        notes: `Internal Transfer (Approved Request: ${transferReq.id}). ${transferReq.notes || ''}`,
                        date: new Date()
                    }
                })

                // Update request
                const updatedRequest = await tx.transferRequest.update({
                    where: { id },
                    data: {
                        status: 'approved',
                        handledById: user.id
                    }
                })
                
                return { updatedRequest, stockItem }
            })

            addNotification(
                "success",
                `Transfer Request for ${transferReq.quantity} units of ${result.stockItem.name} was approved!`,
                undefined,
                transferReq.requestedById
            )

            return NextResponse.json(result.updatedRequest)
        } catch (err: any) {
            return NextResponse.json({ message: err.message }, { status: 400 })
        }

    } catch (error: any) {
        return NextResponse.json({ message: error.message }, { status: error.message.includes("Unauthorized") ? 401 : 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await validateSession(request)
        if (user.role !== 'admin') {
            return NextResponse.json({ message: "Only admins can delete transfers" }, { status: 403 })
        }

        const { id } = await params
        await prisma.transferRequest.delete({
            where: { id: id }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ message: error.message }, { status: 500 })
    }
}
