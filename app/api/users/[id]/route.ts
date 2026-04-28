import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB, prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

const MAIN_ADMIN_EMAIL = "kidayos2014@gmail.com"

function normalizeRole(role?: string) {
  if (!role) return undefined
  return role === "super-admin" ? "super_admin" : role
}

function assertValidRole(role?: string) {
  if (!role) return
  const normalized = normalizeRole(role)
  const allowed = [
    "admin",
    "cashier",
    "chef",
    "bar",
    "display",
    "store_keeper",
    "reception",
    "custom",
    "super_admin",
  ]
  if (!allowed.includes(normalized as string)) {
    throw new Error("Invalid role")
  }
}

// Get single user (admin only)
export async function GET(request: Request, context: any) {
  try {
    const params = await context.params
    const decoded = await validateSession(request)

    if (decoded.role !== "admin" && !(decoded.role === "custom" && decoded.permissions?.includes("users:view"))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    await connectDB()

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        floorId: true,
        assignedCategories: true,
        canManageReception: true,
        lastLoginAt: true,
        lastLogoutAt: true,
        createdAt: true,
        updatedAt: true,
        plainPassword: true,
      },
    })

    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 })

    return NextResponse.json({ ...user, _id: user.id })
  } catch (error: any) {
    console.error("❌ Get user error:", error)
    return NextResponse.json({ message: "Failed to get user" }, { status: 500 })
  }
}

// Update user (admin only)
export async function PUT(request: Request, context: any) {
  try {
    const params = await context.params
    const decoded = await validateSession(request)

    if (decoded.role !== "admin" && !(decoded.role === "custom" && decoded.permissions?.includes("users:update"))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()
    const { name, email, role, password, isActive, floorId, assignedCategories, canManageReception, permissions } = body

    if (!params?.id) return NextResponse.json({ message: "No user ID provided" }, { status: 400 })
    if (!name || !email) return NextResponse.json({ message: "Name and email are required" }, { status: 400 })

    try {
      assertValidRole(role)
    } catch {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 })
    }

    const userId = params.id
    const existingUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!existingUser) return NextResponse.json({ message: "User not found" }, { status: 404 })

    // Prevent admin from updating their own role or deactivating themselves
    if (existingUser.id === decoded.id && (normalizeRole(role) !== existingUser.role || isActive === false)) {
      return NextResponse.json({ message: "Cannot modify your own role or deactivate yourself" }, { status: 400 })
    }

    // Protection for Main Admin (Root User)
    if (existingUser.email === MAIN_ADMIN_EMAIL) {
      if (decoded.email !== MAIN_ADMIN_EMAIL) {
        return NextResponse.json({ message: "Forbidden: Only the main administrator can modify this account" }, { status: 403 })
      }
      if (role && normalizeRole(role) !== "admin") {
        return NextResponse.json({ message: "Cannot demote the root administrator" }, { status: 400 })
      }
      if (isActive === false) {
        return NextResponse.json({ message: "Cannot deactivate the root administrator" }, { status: 400 })
      }
    }

    // Check if email is already taken by another user
    if (email && email !== existingUser.email) {
      const emailOwner = await prisma.user.findUnique({ where: { email } })
      if (emailOwner && emailOwner.id !== userId) {
        return NextResponse.json({ message: "Email already exists" }, { status: 400 })
      }
    }

    const updateData: any = {
      name,
      email,
    }

    if (role) updateData.role = normalizeRole(role)
    if (typeof isActive === "boolean") updateData.isActive = isActive
    if (floorId !== undefined) updateData.floorId = floorId || null
    if (assignedCategories !== undefined) updateData.assignedCategories = assignedCategories || []
    if (canManageReception !== undefined) updateData.canManageReception = !!canManageReception
    if (typeof permissions !== "undefined") updateData.permissions = permissions || []

    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
      updateData.plainPassword = password
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        isActive: true,
        floorId: true,
        assignedCategories: true,
        canManageReception: true,
        lastLoginAt: true,
        lastLogoutAt: true,
        createdAt: true,
        updatedAt: true,
        plainPassword: true,
      },
    })

    return NextResponse.json({
      message: "User updated successfully",
      user: { ...updatedUser, _id: updatedUser.id },
    })
  } catch (error: any) {
    console.error("❌ Update user error:", error)
    return NextResponse.json({ message: "Failed to update user" }, { status: 500 })
  }
}

// Delete user (admin only)
export async function DELETE(request: Request, context: any) {
  try {
    const params = await context.params
    const decoded = await validateSession(request)

    if (decoded.role !== "admin" && !(decoded.role === "custom" && decoded.permissions?.includes("users:delete"))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    await connectDB()

    const userId = params?.id
    if (!userId) return NextResponse.json({ message: "Invalid user ID format" }, { status: 400 })

    const existingUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!existingUser) return NextResponse.json({ message: "User not found" }, { status: 404 })

    if (existingUser.id === decoded.id) return NextResponse.json({ message: "Cannot delete yourself" }, { status: 400 })
    if (existingUser.email === MAIN_ADMIN_EMAIL) {
      return NextResponse.json({ message: "Forbidden: The main administrator account is untouchable and cannot be deleted" }, { status: 403 })
    }

    if (existingUser.role === "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin" } })
      if (adminCount <= 1) return NextResponse.json({ message: "Cannot delete the last admin user" }, { status: 400 })
    }

    await prisma.user.delete({ where: { id: userId } })

    return NextResponse.json({
      message: "User deleted successfully",
      deletedUser: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
      },
    })
  } catch (error: any) {
    console.error("❌ Delete user error:", error)
    return NextResponse.json({ message: "Failed to delete user" }, { status: 500 })
  }
}