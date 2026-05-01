import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
    try {
        const tables = await prisma.table.findMany({
            include: { floor: true }
        })
        tables.sort((a,b) => String(a.tableNumber).localeCompare(String(b.tableNumber), undefined, { numeric: true }))
        const serializedItems = tables.map(t => ({ ...t, _id: t.id }))
        return NextResponse.json(serializedItems)
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to fetch tables" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { tableNumber, name, capacity, floorId, isVIP } = await request.json()

        if (!tableNumber) {
            return NextResponse.json({ message: "Table Number is required" }, { status: 400 })
        }

        const existing = await prisma.table.findUnique({ where: { tableNumber } })
        if (existing) {
            return NextResponse.json({ message: "Table Number already exists" }, { status: 400 })
        }

        const table = await prisma.table.create({
            data: { 
                tableNumber, 
                name, 
                capacity, 
                floorId: floorId === "" ? null : floorId, 
                isVIP: isVIP || false, 
                status: "active" 
            }
        })
        return NextResponse.json({ ...table, _id: table.id }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to create table" }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { id, tableNumber, name, capacity, floorId, isVIP } = await request.json()

        if (!id || !tableNumber) {
            return NextResponse.json({ message: "ID and Table Number are required" }, { status: 400 })
        }

        const existing = await prisma.table.findUnique({ where: { tableNumber } })
        if (existing && existing.id !== id) {
            return NextResponse.json({ message: "Table Number already exists" }, { status: 400 })
        }

        try {
            const updatedTable = await prisma.table.update({
                where: { id },
                data: { 
                    tableNumber, 
                    name, 
                    capacity, 
                    floorId: floorId === "" ? null : floorId, 
                    isVIP 
                }
            })
            return NextResponse.json({ ...updatedTable, _id: updatedTable.id })
        } catch (error: any) {
            if (error.code === 'P2025') return NextResponse.json({ message: "Table not found" }, { status: 404 })
            throw error
        }
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to update table" }, { status: 500 })
    }
}

export async function DELETE(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin" && decoded.role !== "super-admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        if (!id) return NextResponse.json({ message: "ID is required" }, { status: 400 })

        try {
            await prisma.table.delete({ where: { id } })
            return NextResponse.json({ message: "Table deleted" })
        } catch (error: any) {
            if (error.code === 'P2025') return NextResponse.json({ message: "Table not found" }, { status: 404 })
            throw error
        }
    } catch (error: any) {
        return NextResponse.json({ message: "Failed to delete table" }, { status: 500 })
    }
}
