import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
    try {
        await validateSession(request)
        const floors = await prisma.floor.findMany({
            where: { isActive: true },
            orderBy: { order: "asc" },
        })
        // Keep `_id` for backward compatibility with older UI code.
        return NextResponse.json(floors.map((f) => ({ ...f, _id: f.id })))
    } catch (error: any) {
        console.error("Failed to fetch floors:", error)
        return NextResponse.json({ message: "Failed to fetch floors" }, { status: 500 })
    }
}
