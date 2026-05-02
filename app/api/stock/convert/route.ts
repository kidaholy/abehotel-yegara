import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"


export async function POST(request: Request) {
        try {
            const decoded = await validateSession(request)
            if (decoded.role !== "admin") {
                return NextResponse.json({ message: "Forbidden" }, { status: 403 })
            }

            const { sourceId, targetId, sourceQuantity, targetYield } = await request.json()

        if (!sourceId || !targetId || !sourceQuantity || !targetYield) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
        }

        // 1. Decrement source
        const sourceItem = await prisma.stock.findUnique({ where: { id: sourceId } })
        if (!sourceItem || sourceItem.quantity < sourceQuantity) {
            return NextResponse.json({ message: "Insufficient source quantity" }, { status: 400 })
        }

        await prisma.stock.update({
            where: { id: sourceId },
            data: { quantity: sourceItem.quantity - sourceQuantity }
        })

        // 2. Increment target
        const targetItem = await prisma.stock.findUnique({ where: { id: targetId } })
        if (!targetItem) {
            return NextResponse.json({ message: "Target item not found" }, { status: 404 })
        }

        await prisma.stock.update({
            where: { id: targetId },
            data: { quantity: targetItem.quantity + targetYield }
        })

        return NextResponse.json({
            message: "Conversion successful",
            source: { name: sourceItem.name, newQuantity: sourceItem.quantity - sourceQuantity },
            target: { name: targetItem.name, newQuantity: targetItem.quantity + targetYield }
        })

    } catch (error: any) {
        console.error("❌ Stock conversion error:", error)
        return NextResponse.json({ message: "Failed to convert stock" }, { status: 500 })
    }
}
