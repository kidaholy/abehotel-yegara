import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
import { prisma } from "@/lib/prisma"

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
      where: { key: { in: publicSettingKeys } },
      select: { key: true, value: true },
    })

    const settingsObject = publicSettings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>)

    // Provide defaults if settings don't exist
    const defaultSettings = {
      logo_url: "",
      favicon_url: "",
      app_name: "Prime Addis",
      app_tagline: "Coffee Management",
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
      app_name: "Prime Addis",
      app_tagline: "Coffee Management"
    })
  }
}