import { NextResponse } from "next/server"
import { validateSession } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const decoded = await validateSession(request)

    // Only admins and super-admins can access settings
    if (decoded.role !== "admin" && decoded.role !== "super-admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const settings = await prisma.settings.findMany()

    // Convert to key-value object for easier frontend usage
    const settingsObject = settings.reduce((acc: any, setting: any) => {
      acc[setting.key] = {
        value: setting.value,
        type: setting.type || "string",
        description: setting.description || "",
        updatedAt: setting.updatedAt
      }
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json(settingsObject)
  } catch (error: any) {
    console.error("Get settings error:", error)
    return NextResponse.json({ message: "Failed to get settings" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const decoded = await validateSession(request)

    if (decoded.role !== "admin" && decoded.role !== "super-admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const { key, value, type, description } = await request.json()

    if (!key || value === undefined) {
      return NextResponse.json({ message: "Key and value are required" }, { status: 400 })
    }

    const setting = await prisma.settings.upsert({
      where: { key },
      update: {
        value: String(value),
        type: type || "string",
        description: description || "",
      },
      create: {
        key,
        value: String(value),
        type: type || "string",
        description: description || "",
      },
    })

    return NextResponse.json(setting)
  } catch (error: any) {
    console.error("Update settings error:", error)
    return NextResponse.json({ message: "Failed to update setting" }, { status: 500 })
  }
}