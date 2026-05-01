import { NextResponse } from "next/server"
import { SettingsType } from "@prisma/client"
import { validateSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const toSettingsType = (value: unknown): SettingsType => {
  const raw = String(value ?? "string")
  if (raw === "url" || raw === "boolean" || raw === "number" || raw === "string") {
    return raw
  }
  return "string"
}

export async function GET(request: Request) {
  try {
    const decoded = await validateSession(request)

    // Only admins can access settings
    if (decoded.role !== "admin") {
      return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 })
    }

    const settings = await prisma.settings.findMany({
      select: {
        key: true,
        value: true,
        type: true,
        description: true,
        updatedAt: true,
      },
    })

    // Convert to key-value object for easier frontend usage
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = {
        value: setting.value,
        type: setting.type,
        description: setting.description,
        updatedAt: setting.updatedAt
      }
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json(settingsObject)
  } catch (error: any) {
    console.error("Get settings error:", error)
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to get settings" }, { status })
  }
}

export async function PUT(request: Request) {
  try {
    const decoded = await validateSession(request)

    // Only admins can update settings
    if (decoded.role !== "admin") {
      return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 })
    }

    const { key, value, type, description } = await request.json()
    const settingsType = toSettingsType(type)

    if (!key || value === undefined) {
      return NextResponse.json({ message: "Key and value are required" }, { status: 400 })
    }

    const setting = await prisma.settings.upsert({
      where: { key },
      update: {
        value: String(value),
        type: settingsType,
        description,
      },
      create: {
        key,
        value: String(value),
        type: settingsType,
        description,
      },
    })

    console.log(`✅ Setting updated: ${key} (Type: ${type}, Value Length: ${String(value).length})`)
    return NextResponse.json(setting)
  } catch (error: any) {
    console.error("Update settings error:", error)
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to update setting" }, { status })
  }
}