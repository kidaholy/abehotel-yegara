import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const publicSettingKeys = [
      "logo_url",
      "favicon_url",
      "app_name",
      "app_tagline",
      "vat_rate",
      "enable_cashier_printing",
      "enable_cashier_today_revenue",
    ]

    const publicSettings = await prisma.settings.findMany({
      where: { key: { in: publicSettingKeys } }
    })

    const settingsObject = publicSettings.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)

    // Provide defaults if settings don't exist
    const defaultSettings = {
      logo_url: "",
      favicon_url: "",
      app_name: "Abe Hotel",
      app_tagline: "Hotel Management System",
      enable_cashier_printing: "true",
      enable_cashier_today_revenue: "false",
      ...settingsObject
    }

    return NextResponse.json(defaultSettings)
  } catch (error: any) {
    console.error("Get public settings error:", error)
    // Return defaults on error
    return NextResponse.json({
      logo_url: "",
      app_name: "Abe Hotel",
      app_tagline: "Hotel Management System",
      enable_cashier_printing: "true",
      enable_cashier_today_revenue: "false"
    })
  }
}