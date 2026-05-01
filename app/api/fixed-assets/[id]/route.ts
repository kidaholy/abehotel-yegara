import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

// PUT update asset or dismiss
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { id } = await params

        const asset = await prisma.fixedAsset.findUnique({
            where: { id },
            include: { dismissals: true }
        })
        if (!asset) {
            return NextResponse.json({ message: "Asset not found" }, { status: 404 })
        }

        // Dismissal action
        if (body.action === 'dismiss') {
            const { quantity, reason, valueLost } = body

            if (!quantity || !reason) {
                return NextResponse.json({ message: "Quantity and reason are required for dismissal" }, { status: 400 })
            }

            const dismissQty = Number(quantity)
            const lostValue = Number(valueLost || 0) || (dismissQty * asset.unitPrice)

            if (dismissQty > asset.quantity) {
                return NextResponse.json({ message: `Cannot dismiss ${dismissQty}. Only ${asset.quantity} remaining.` }, { status: 400 })
            }

            const updatedAsset = await prisma.fixedAsset.update({
                where: { id: asset.id },
                data: {
                    quantity: asset.quantity - dismissQty,
                    totalValue: Math.max(0, asset.totalValue - lostValue),
                    dismissals: {
                        create: {
                            quantity: dismissQty,
                            reason,
                            valueLost: lostValue,
                            dismissedById: decoded.id
                        }
                    }
                },
                include: { dismissals: true }
            })

            return NextResponse.json({
                message: `Dismissed ${dismissQty} unit(s). Value decreased by ${lostValue.toLocaleString()} ETB.`,
                asset: { ...updatedAsset, _id: updatedAsset.id }
            })
        }

        // Regular update
        const updateData: any = {}
        if (body.name) updateData.name = body.name
        if (body.category) updateData.category = body.category
        if (body.notes !== undefined) updateData.notes = body.notes
        if (body.unitPrice) {
            updateData.unitPrice = Number(body.unitPrice)
            updateData.totalValue = asset.quantity * updateData.unitPrice
        }
        if (body.purchaseDate) updateData.purchaseDate = new Date(body.purchaseDate)

        const savedAsset = await prisma.fixedAsset.update({
            where: { id: asset.id },
            data: updateData,
            include: { dismissals: true }
        })

        return NextResponse.json({
            ...savedAsset,
            _id: savedAsset.id
        })
    } catch (error: any) {
        console.error("❌ Update fixed asset error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to update fixed asset" }, { status })
    }
}

// DELETE remove an asset
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { id } = await params

        await prisma.fixedAsset.delete({
            where: { id }
        })

        return NextResponse.json({ message: "Asset deleted successfully" })
    } catch (error: any) {
        if (error.code === 'P2025') {
            return NextResponse.json({ message: "Asset not found" }, { status: 404 })
        }
        console.error("❌ Delete fixed asset error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to delete fixed asset" }, { status })
    }
}
