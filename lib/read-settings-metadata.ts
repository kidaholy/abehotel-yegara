import fs from "fs"
import path from "path"

/** Reads settings for generateMetadata only — avoids importing json-db (heavy fs init) in the root layout. */
export async function readSettingsForMetadata(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const want = new Set(keys)
  try {
    const filePath = path.join(process.cwd(), "data", "settings.json")
    const text = await fs.promises.readFile(filePath, "utf-8")
    const rows = JSON.parse(text) as unknown
    if (!Array.isArray(rows)) return out
    for (const row of rows) {
      if (!row || typeof row !== "object") continue
      const r = row as { key?: unknown; value?: unknown }
      if (typeof r.key !== "string" || typeof r.value !== "string") continue
      if (want.has(r.key)) out[r.key] = r.value
    }
  } catch {
    // missing or invalid file — metadata fallbacks apply
  }
  return out
}
