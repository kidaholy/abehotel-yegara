import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const decoded = await validateSession(req)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await req.json()
        try {
            const room = await prisma.room.update({ where: { id }, data: body })
            return NextResponse.json(room)
        } catch (e) {
            return NextResponse.json({ message: "Room not found" }, { status: 404 })
        }
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to update room" }, { status: 500 })
    }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const decoded = await validateSession(req)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        try {
            const room = await prisma.room.update({ where: { id }, data: { isActive: false } })
            return NextResponse.json({ message: "Room deleted successfully" })
        } catch (e) {
            return NextResponse.json({ message: "Room not found" }, { status: 404 })
        }
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to delete room" }, { status: 500 })
    }
}
