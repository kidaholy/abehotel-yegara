import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export const dynamic = 'force-dynamic'

// Middleware helper to verify admin access
const verifyAdmin = async (request: Request) => {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") return null
        return decoded
    } catch (error) {
        return null
    }
}

export async function GET(request: Request) {
    try {
        if (!(await verifyAdmin(request))) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

        const floors = await prisma.floor.findMany({
            orderBy: { order: 'asc' }
        })
        const serialized = floors.map(f => ({
            ...f,
            _id: f.id,
            roomServiceCashierId: f.roomServiceCashierId || null
        }))
        return NextResponse.json(serialized)
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to fetch floors" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        if (!(await verifyAdmin(request))) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

        const body = await request.json()
        const { floorNumber, description, order, isVIP, type, roomServiceMenuTier } = body

        if (!floorNumber) {
            return NextResponse.json({ message: "Floor Number is required" }, { status: 400 })
        }

        const dataPayload: any = {
            floorNumber,
            description,
            order: order || 0,
            isVIP: isVIP || false
        }
        if (type) dataPayload.type = type as any
        if (roomServiceMenuTier) dataPayload.roomServiceMenuTier = roomServiceMenuTier as any

        const floor = await prisma.floor.create({ data: dataPayload })

        return NextResponse.json({ ...floor, _id: floor.id }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to create floor" }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    try {
        if (!(await verifyAdmin(request))) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

        const body = await request.json()
        const { id } = body

        if (!id) {
            return NextResponse.json({ message: "ID is required" }, { status: 400 })
        }

        const updateObj: any = {}
        const fields = ['floorNumber', 'description', 'order', 'isActive', 'isVIP']
        fields.forEach(f => {
            if (body[f] !== undefined) updateObj[f] = body[f]
        })
        if (body.type !== undefined) updateObj.type = body.type as any
        if (body.roomServiceCashierId !== undefined) updateObj.roomServiceCashierId = body.roomServiceCashierId
        if (body.roomServiceMenuTier !== undefined) updateObj.roomServiceMenuTier = body.roomServiceMenuTier as any

        console.log("🛠️ Attempting update for floor:", id, updateObj)

        try {
            const updatedFloor = await prisma.floor.update({
                where: { id },
                data: updateObj
            })
            console.log("✅ Floor updated result:", updatedFloor)

            const serialized = {
                ...updatedFloor,
                _id: updatedFloor.id,
                roomServiceCashierId: updatedFloor.roomServiceCashierId || null
            }
            return NextResponse.json(serialized)
        } catch (error: any) {
            if (error.code === 'P2025') {
                console.log("❌ Floor not found for update:", id)
                return NextResponse.json({ message: "Floor not found" }, { status: 404 })
            }
            throw error
        }
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to update floor" }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        if (!(await verifyAdmin(request))) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        if (!id) return NextResponse.json({ message: "ID is required" }, { status: 400 })

        try {
            await prisma.floor.delete({ where: { id } })
            return NextResponse.json({ message: "Floor deleted" })
        } catch (error: any) {
            if (error.code === 'P2025') {
                return NextResponse.json({ message: "Floor not found" }, { status: 404 })
            }
            throw error
        }
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to delete floor" }, { status: 500 })
    }
}
