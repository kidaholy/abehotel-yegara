import "./dns-fix"
import { prisma } from "./prisma"

/**
 * Backward-compatible entrypoint used across API routes.
 * For PostgreSQL/Prisma there is no explicit connect needed per request.
 */
export async function connectDB() {
  return prisma
}

export { prisma }
