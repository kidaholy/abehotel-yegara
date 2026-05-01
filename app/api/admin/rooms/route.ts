import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    try {
        const rooms = await prisma.room.findMany({
            where: { isActive: true },
            orderBy: { roomNumber: 'asc' },
            include: { floor: true }
        })

        const serialized = rooms.map(room => ({
            ...room,
            _id: room.id,
            floorId: room.floor ? { ...room.floor, _id: room.floor.id } : room.floorId
        }))

        return NextResponse.json(serialized)
    } catch (error) {
        return NextResponse.json({ message: "Failed to fetch rooms" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const decoded = await validateSession(req)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await req.json()
        
        if (!body.roomNumber || !body.floorId) {
            return NextResponse.json({ message: "Room number and floor are required" }, { status: 400 })
        }

        const dataPayload: any = {
            roomNumber: body.roomNumber,
            floorId: body.floorId,
            name: body.name,
            category: body.category,
            description: body.description,
            isActive: body.isActive !== false
        }
        if (body.type) dataPayload.type = body.type as any
        if (body.status) dataPayload.status = body.status as any
        if (body.price !== undefined) dataPayload.price = Number(body.price)
        if (body.roomServiceMenuTier) dataPayload.roomServiceMenuTier = body.roomServiceMenuTier as any

        const room = await prisma.room.create({ data: dataPayload })
        return NextResponse.json({ ...room, _id: room.id }, { status: 201 })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ message: "Room number already exists" }, { status: 400 })
        }
        return NextResponse.json({ message: "Failed to create room" }, { status: 500 })
    }
}
