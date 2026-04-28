import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

// Get all users (admin only)
export async function GET(request: Request) {
  try {
    const decoded = await validateSession(request)
    console.log("📋 Admin fetching users:", decoded.email || decoded.id)

    if (decoded.role !== "admin" && !(decoded.role === "custom" && decoded.permissions?.includes("users:view"))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    await connectDB()
    console.log("📊 Database connected for user retrieval")

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
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

    console.log(`Found ${users.length} users in database`)

    return NextResponse.json(
      users.map((u) => ({
        ...u,
        _id: u.id,
      })),
    )
  } catch (error: any) {
    console.error("❌ Get users error:", error)
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to get users" }, { status })
  }
}

// Create new user (admin only)
export async function POST(request: Request) {
  try {
    const decoded = await validateSession(request)
    console.log("🔐 Admin creating user:", decoded.email || decoded.id)

    if (decoded.role !== "admin" && !(decoded.role === "custom" && decoded.permissions?.includes("users:create"))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    await connectDB()
    console.log("📊 Database connected for user creation")

    const { name, email, role, password, floorId, assignedCategories, permissions } = await request.json()
    console.log("📝 User data received:", { name, email, role, passwordLength: password?.length, assignedCategories, permissions })

    if (!name || !email || !role || !password) {
      return NextResponse.json({ message: "All fields required" }, { status: 400 })
    }

    // Validate role
    const normalizedRole = role === "super-admin" ? "super_admin" : role
    if (!['admin', 'cashier', 'chef', 'display', 'store_keeper', 'reception', 'bar', 'custom', 'super_admin'].includes(normalizedRole)) {
      console.log("❌ Invalid role:", role)
      return NextResponse.json({ message: "Invalid role" }, { status: 400 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      console.log("❌ User already exists:", email)
      return NextResponse.json({ message: "User already exists" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    console.log("🔒 Password hashed successfully")

    // Create user data
    const userData = {
      name,
      email,
      password: hashedPassword,
      plainPassword: password, // Store plain password for admin view
      role: normalizedRole,
      permissions: (normalizedRole === "custom" && permissions) ? permissions : [],
      isActive: true,
      floorId: floorId || null,
      assignedCategories: (normalizedRole === 'chef' && assignedCategories) ? assignedCategories : [],
    }

    console.log("💾 Creating user in database:", { ...userData, password: "[HIDDEN]" })

    // Create user
    const user = await prisma.user.create({ data: userData as any })
    console.log("✅ User created successfully:", user.id)

    return NextResponse.json({
      message: "User created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        floorId: user.floorId,
      },
      credentials: {
        email,
        password, // Return plain password for admin to share
      },
    })
  } catch (error: any) {
    console.error("❌ Create user error:", error)
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to create user" }, { status })
  }
}
