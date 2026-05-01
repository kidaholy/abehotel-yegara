import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const decoded = await validateSession(request)
    await prisma.user.update({
      where: { id: decoded.id },
      data: { lastLogoutAt: new Date() }
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // silent — logout always succeeds
  }
}
