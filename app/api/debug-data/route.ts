import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
    try {
        const floors = await prisma.floor.findMany()
        const tables = await prisma.table.findMany()
        const users = await prisma.user.findMany({ where: { role: "cashier" } })

        return NextResponse.json({
            floors: floors.map(b => ({
                _id: b.id,
                floorNumber: b.floorNumber,
                isActive: b.isActive,
                idType: typeof b.id
            })),
            tables: tables.map(t => ({
                _id: t.id,
                tableNumber: t.tableNumber,
                floorId: t.floorId,
                floorIdType: typeof t.floorId,
                status: t.status
            })),
            cashiers: users.map(u => ({
                _id: u.id,
                name: u.name,
                email: u.email,
                floorId: u.floorId,
                floorIdType: typeof u.floorId
            }))
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
