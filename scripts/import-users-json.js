const fs = require("fs")
const path = require("path")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

function asDate(value) {
  if (!value) return null
  if (value.$date) return new Date(value.$date)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function asOid(value) {
  if (!value) return null
  if (typeof value === "string") return value
  if (value.$oid) return value.$oid
  return null
}

function normalizePermissions(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((x) => typeof x === "string")

  // Handles Mongo object shape like { menu: { read:true, ... }, reports: { read:false } }
  if (typeof value === "object") {
    const out = []
    for (const [moduleName, actions] of Object.entries(value)) {
      if (!actions || typeof actions !== "object") continue
      for (const [actionName, enabled] of Object.entries(actions)) {
        if (enabled === true) out.push(`${moduleName}:${actionName}`)
      }
    }
    return out
  }

  return []
}

function normalizeRole(role) {
  const allowed = new Set([
    "admin",
    "cashier",
    "chef",
    "bar",
    "display",
    "store_keeper",
    "reception",
    "custom",
    "super_admin",
  ])
  return allowed.has(role) ? role : "cashier"
}

async function run() {
  const input = process.argv[2]
  if (!input) {
    console.error("Usage: node scripts/import-users-json.js <path-to-users-json>")
    process.exit(1)
  }

  const filePath = path.resolve(input)
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, "utf8")
  const users = JSON.parse(raw)
  if (!Array.isArray(users)) {
    console.error("JSON root must be an array")
    process.exit(1)
  }

  const floorIds = new Set((await prisma.floor.findMany({ select: { id: true } })).map((f) => f.id))

  let imported = 0
  let skipped = 0

  for (const u of users) {
    const id = asOid(u._id)
    if (!id || !u.email || !u.name || !u.password) {
      skipped++
      continue
    }

    const floorIdRaw = asOid(u.floorId)
    const floorId = floorIdRaw && floorIds.has(floorIdRaw) ? floorIdRaw : null

    await prisma.user.upsert({
      where: { id },
      update: {
        name: u.name,
        email: u.email,
        password: u.password,
        plainPassword: u.plainPassword || null,
        role: normalizeRole(String(u.role || "cashier")),
        permissions: normalizePermissions(u.permissions),
        isActive: u.isActive !== false,
        floorId,
        assignedCategories: Array.isArray(u.assignedCategories) ? u.assignedCategories : [],
        canManageReception: u.canManageReception === true,
        lastLoginAt: asDate(u.lastLoginAt),
        lastLogoutAt: asDate(u.lastLogoutAt),
        createdAt: asDate(u.createdAt) || new Date(),
        updatedAt: asDate(u.updatedAt) || new Date(),
      },
      create: {
        id,
        name: u.name,
        email: u.email,
        password: u.password,
        plainPassword: u.plainPassword || null,
        role: normalizeRole(String(u.role || "cashier")),
        permissions: normalizePermissions(u.permissions),
        isActive: u.isActive !== false,
        floorId,
        assignedCategories: Array.isArray(u.assignedCategories) ? u.assignedCategories : [],
        canManageReception: u.canManageReception === true,
        lastLoginAt: asDate(u.lastLoginAt),
        lastLogoutAt: asDate(u.lastLogoutAt),
        createdAt: asDate(u.createdAt) || new Date(),
        updatedAt: asDate(u.updatedAt) || new Date(),
      },
    })

    imported++
  }

  console.log(`Users import complete. Imported/updated: ${imported}, skipped: ${skipped}`)
}

run()
  .catch((err) => {
    console.error("Users import failed:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

