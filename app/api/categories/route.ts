import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

// GET categories by type
export async function GET(request: Request) {
    try {
        await validateSession(request)
        const { searchParams } = new URL(request.url)
        const type = searchParams.get("type")

        const query = type ? { type: type as any } : {}
        const categories = await prisma.category.findMany({
            where: query,
            orderBy: { name: 'asc' }
        })

        const serialized = categories.map(c => ({
            ...c,
            _id: c.id
        }))

        return NextResponse.json(serialized)
    } catch (error: any) {
        console.error("❌ Get categories error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to get categories" }, { status })
    }
}

// POST create new category (Admin only)
export async function POST(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { name, type, description } = body

        if (!name || !type) {
            return NextResponse.json({ message: "Name and type are required" }, { status: 400 })
        }

        const newCategory = await prisma.category.create({
            data: {
                name: name.trim().normalize("NFC"),
                type: type as any,
                description: description?.trim()
            }
        })

        return NextResponse.json({ ...newCategory, _id: newCategory.id }, { status: 201 })
    } catch (error: any) {
        console.error("❌ Create category error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to create category" }, { status })
    }
}

// DELETE category (Admin only)
export async function DELETE(request: Request) {
    try {
        const decoded = await validateSession(request)
        if (decoded.role !== "admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get("id")

        if (!id) {
            return NextResponse.json({ message: "ID is required" }, { status: 400 })
        }

        try {
            await prisma.category.delete({
                where: { id }
            })
        } catch (e: any) {
            if (e.code === 'P2025') {
                return NextResponse.json({ message: "Category not found" }, { status: 404 })
            }
            throw e
        }

        return NextResponse.json({ message: "Category deleted" })
    } catch (error: any) {
        console.error("❌ Delete category error:", error)
        const status = error.message?.includes("Unauthorized") ? 401 : 500
        return NextResponse.json({ message: "Failed to delete category" }, { status })
    }
}
