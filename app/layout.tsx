import type React from "react"
import type { Metadata } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { AuthProvider } from "@/context/auth-context"
import { ThemeProvider } from "@/context/theme-context"
import { SettingsProvider } from "@/context/settings-context"
import { NotificationProvider } from "@/context/notification-context"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair" })

export const dynamic = "force-dynamic"
export const revalidate = 0

import { prisma } from "@/lib/prisma"

/** Data URLs and very long strings in metadata icons break Next.js head generation (500s in production). */
function iconUrlForMetadata(raw: string | undefined, timestamp: number): string {
  if (!raw || raw.startsWith("data:") || raw.length > 2048) {
    return "/icon.svg"
  }
  const sep = raw.includes("?") ? "&" : "?"
  return `${raw}${sep}v=${timestamp}`
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settingsObj: Record<string, string> = {}

    try {
      const settings = await prisma.settings.findMany({
        where: { key: { in: ["logo_url", "favicon_url", "app_name", "app_tagline"] } }
      })

      settings.forEach((s) => {
        settingsObj[s.key] = s.value
      })
    } catch (err) {
      console.error("Failed to fetch settings for metadata:", err)
    }

    const timestamp = Date.now()
    const iconSource = settingsObj.favicon_url || settingsObj.logo_url
    const logoUrl = iconUrlForMetadata(iconSource, timestamp)

    const appName = settingsObj.app_name || "Prime Addis"

    return {
      title: `${appName} - Management System`,
      description: settingsObj.app_tagline || "Coffee Shop Management System",
      icons: {
        icon: [{ url: logoUrl, sizes: "any" }],
        shortcut: [logoUrl],
        apple: [{ url: logoUrl }],
      },
    }
  } catch (err) {
    console.error("generateMetadata failed:", err)
    return {
      title: "Abe Hotel - Management System",
      description: "Hotel Management System",
      icons: {
        icon: [{ url: "/icon.svg", sizes: "any" }],
        shortcut: ["/icon.svg"],
        apple: [{ url: "/icon.svg" }],
      },
    }
  }
}

import { LanguageProvider } from "@/context/language-context"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-background text-foreground overflow-x-hidden`} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(let registration of registrations) {
                    registration.unregister();
                  }
                });
              }
            `,
          }}
        />
        <LanguageProvider>
          <ThemeProvider>
            <SettingsProvider>
              <AuthProvider>
                <NotificationProvider>
                  {children}
                </NotificationProvider>
              </AuthProvider>
            </SettingsProvider>
          </ThemeProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
