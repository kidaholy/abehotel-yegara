import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

// DELETE category (Admin only)
export async function DELETE(request: Request, context: any) {
    try {
        const { id } = await context.params
        const decoded = await validateSession(request)
        if (decoded.role !== "admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const categoryToDelete = await prisma.category.findUnique({ where: { id } })
        if (!categoryToDelete) {
            return NextResponse.json({ message: "Category not found" }, { status: 404 })
        }

        const { name: oldName, type } = categoryToDelete
        await prisma.category.delete({ where: { id } })

        // Sync items - set to default/Uncategorized
        const newCategoryName = type === 'fixed-asset' ? 'General' : 'Uncategorized'
        
        if (type === 'menu' as any) {
            await prisma.menuItem.updateMany({ where: { category: oldName }, data: { category: newCategoryName } })
        } else if (type === 'stock' as any) {
            await prisma.stock.updateMany({ where: { category: oldName }, data: { category: newCategoryName } })
        } else if (type === 'fixed-asset' as any) {
            await prisma.fixedAsset.updateMany({ where: { category: oldName }, data: { category: newCategoryName } })
        } else if (type === 'expense' as any) {
            await prisma.operationalExpense.updateMany({ where: { category: oldName }, data: { category: newCategoryName } })
        }

        return NextResponse.json({ message: "Category deleted and items updated successfully" })
    } catch (error: any) {
        console.error("❌ Delete category error:", error)
        return NextResponse.json({ message: "Failed to delete category" }, { status: 500 })
    }
}

// PUT update category (Admin only)
export async function PUT(request: Request, context: any) {
    try {
        const { id } = await context.params
        const decoded = await validateSession(request)
        if (decoded.role !== "admin") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const body = await request.json()
        const { name } = body

        if (!name) {
            return NextResponse.json({ message: "Name is required" }, { status: 400 })
        }

        const oldCategory = await prisma.category.findUnique({ where: { id } })
        if (!oldCategory) {
            return NextResponse.json({ message: "Category not found" }, { status: 404 })
        }

        const oldName = oldCategory.name
        const type = oldCategory.type
        const newName = name.trim().normalize("NFC")

        const updatedCategory = await prisma.category.update({
            where: { id },
            data: { name: newName }
        })

        // Sync items if name changed
        if (oldName !== newName) {
            if (type === 'menu' as any) {
                await prisma.menuItem.updateMany({ where: { category: oldName }, data: { category: newName } })
            } else if (type === 'stock' as any) {
                await prisma.stock.updateMany({ where: { category: oldName }, data: { category: newName } })
            } else if (type === 'fixed-asset' as any) {
                await prisma.fixedAsset.updateMany({ where: { category: oldName }, data: { category: newName } })
            } else if (type === 'expense' as any) {
                await prisma.operationalExpense.updateMany({ where: { category: oldName }, data: { category: newName } })
            }
        }

        return NextResponse.json({ ...updatedCategory, _id: updatedCategory.id })
    } catch (error: any) {
        console.error("❌ Update category error:", error)
        return NextResponse.json({ message: "Failed to update category" }, { status: 500 })
    }
}
