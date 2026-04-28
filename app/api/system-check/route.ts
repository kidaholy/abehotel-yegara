import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import { prisma } from "@/lib/db"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
  const checks = {
    database: { status: "unknown", details: "" },
    collections: { status: "unknown", details: {} },
    auth: { status: "unknown", details: "" },
    environment: { status: "unknown", details: {} },
    debug_data: { status: "unknown", details: {} }
  }

  try {
    // Check database connection and run one-time migrations
    try {
      await connectDB()
      checks.database.status = "✅ Connected"
      checks.database.details = "PostgreSQL connection available"


    } catch (error) {
      checks.database.status = "❌ Failed"
      checks.database.details = error instanceof Error ? error.message : "Unknown error"
    }

    // Check collections
    try {
      const [userCount, menuItemCount] = await Promise.all([
        prisma.user.count(),
        prisma.menuItem.count(),
      ])

      checks.collections.status = "✅ Available"
      checks.collections.details = {
        users: userCount,
        menuItems: menuItemCount
      }
    } catch (error) {
      checks.collections.status = "❌ Failed"
      checks.collections.details = error instanceof Error ? error.message : "Unknown error"
    }

    // Check authentication
    let currentUser = null
    try {
      const decoded = await validateSession(request)
      checks.auth.status = "✅ Valid"
      checks.auth.details = `User: ${decoded.email || decoded.id} (${decoded.role})`

      // Fetch fresh user data to return to client
      if (decoded.id) {
        const rawUser = await prisma.user.findUnique({
          where: { id: decoded.id },
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
            floor: { select: { id: true, floorNumber: true } },
          },
        })

        if (rawUser) {
          currentUser = {
            ...rawUser,
            _id: rawUser.id,
            floorNumber: rawUser.floor?.floorNumber || "",
            floorId: rawUser.floor?.id || rawUser.floorId,
          }
        }
      }
    } catch (error: any) {
      if (error.message.includes("No token supported")) {
        checks.auth.status = "⚠️ No Token"
        checks.auth.details = "No authorization header provided"
      } else {
        checks.auth.status = "❌ Invalid/Deactivated"
        checks.auth.details = error.message
      }
    }

    // Check environment
    checks.environment.status = "✅ Loaded"
    checks.environment.details = {
      nodeEnv: process.env.NODE_ENV || "development",
      databaseUrl: process.env.DATABASE_URL ? "Set" : "Missing",
      jwtSecret: process.env.JWT_SECRET ? "Set" : "Missing"
    }

    // Add debug data
    try {
      const [recentOrders, sampleMenuItems, allCategories] = await Promise.all([
        prisma.order.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            orderNumber: true,
            status: true,
            items: { select: { name: true, category: true } },
          },
        }),
        prisma.menuItem.findMany({
          take: 5,
          select: { name: true, category: true },
        }),
        prisma.category.findMany({
          select: { name: true },
        }),
      ])

      checks.debug_data.status = "✅ Collected"
      checks.debug_data.details = {
        recent_orders: recentOrders.map((o) => ({
          num: o.orderNumber,
          items: (o.items || []).map((i) => ({ name: i.name, cat: i.category })),
          status: o.status
        })),
        menu_samples: sampleMenuItems.map((m) => ({ name: m.name, cat: m.category })),
        all_categories: allCategories.map((c) => c.name)
      }
    } catch (err) {
      checks.debug_data.status = "❌ Failed"
      checks.debug_data.details = err instanceof Error ? err.message : "Unknown error"
    }

    const authFailed = checks.auth.status.includes("❌ Invalid/Deactivated")
    const isUnauthorized = checks.auth.details.includes("Unauthorized")

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall: Object.values(checks).every(check => check.status.includes("✅")) ? "✅ Healthy" : "⚠️ Issues Found",
      checks,
      user: currentUser // Return fresh user data
    }, { status: (authFailed && isUnauthorized) ? 401 : 200 })

  } catch (error) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall: "❌ Critical Error",
      error: error instanceof Error ? error.message : "Unknown error",
      checks
    }, { status: 500 })
  }
}