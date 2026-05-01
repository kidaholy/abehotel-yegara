import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin" && decoded.role !== "store_keeper" && !(decoded.role === "custom" && decoded.permissions?.includes("store:view"))) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get("status")
        const category = searchParams.get("category")

        let query: any = {}
        if (status) query.status = status
        if (category) query.category = category

        const assets = await prisma.fixedAsset.findMany({
            where: query,
            orderBy: { createdAt: 'desc' }
        })

        const serialized = assets.map((a: any) => ({
            ...a,
            _id: a.id,
            dismissals: []
        }))

        return NextResponse.json(serialized)
    } catch (error: any) {
        console.error("❌ Get fixed assets error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to get fixed assets" }, { status })
    }
}

export async function POST(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin" && !(decoded.role === "custom" && decoded.permissions?.includes("store:create"))) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { name, category, quantity, unitPrice, purchaseDate, notes } = body

        if (!name || !quantity || !unitPrice) {
            return NextResponse.json({ message: "Name, quantity, and unit price are required" }, { status: 400 })
        }

        const qty = Number(quantity)
        const price = Number(unitPrice)
        const totalValue = qty * price

        const asset = await prisma.fixedAsset.create({
            data: {
                name,
                category: category || "General",
                quantity: qty,
                unitPrice: price,
                totalValue,
                totalInvested: totalValue,
                purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
                notes,
                status: 'active'
            }
        })

        return NextResponse.json({
            ...asset,
            _id: asset.id
        }, { status: 201 })
    } catch (error: any) {
        console.error("❌ Create fixed asset error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to create fixed asset" }, { status })
    }
}
