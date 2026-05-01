import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
    try {
        await validateSession(request)
        const tables = await prisma.table.findMany({
            where: { status: "active" }
        })
        tables.sort((a: any, b: any) => String(a.tableNumber).localeCompare(String(b.tableNumber), undefined, { numeric: true }))
        const serializedTables = tables.map(t => ({
            _id: t.id,
            tableNumber: t.tableNumber,
            capacity: t.capacity
        }))
        return NextResponse.json(serializedTables)
    } catch (error: any) {
        console.error("Failed to fetch tables:", error)
        return NextResponse.json({ message: "Failed to fetch tables" }, { status: 500 })
    }
}
