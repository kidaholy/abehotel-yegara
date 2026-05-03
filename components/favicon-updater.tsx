"use client"
import { useSettings } from "@/context/settings-context"
import { useEffect } from "react"

export function FaviconUpdater() {
  const { settings } = useSettings()

  useEffect(() => {
    if (!settings) return
    const logoUrl = settings.favicon_url || settings.logo_url
    
    if (logoUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
      if (!link) {
        link = document.createElement("link")
        link.type = "image/x-icon"
        link.rel = "shortcut icon"
        document.getElementsByTagName("head")[0].appendChild(link)
      }
      link.href = logoUrl
    }
  }, [settings.favicon_url, settings.logo_url])

  return null
}
