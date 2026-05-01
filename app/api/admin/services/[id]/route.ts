import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function PUT(request: Request, context: any) {
  try {
    const { id } = await context.params
    const decoded = await validateSession(request)
    if (decoded.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    const body = await request.json()
    try {
      const updated = await prisma.service.update({ where: { id }, data: body })
      return NextResponse.json({ message: "Service updated", service: { ...updated, _id: updated.id } })
    } catch (e) {
      return NextResponse.json({ message: "Service not found" }, { status: 404 })
    }
  } catch (error: any) {
    return NextResponse.json({ message: "Failed to update service" }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const { id } = await context.params
    const decoded = await validateSession(request)
    if (decoded.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    try {
      await prisma.service.delete({ where: { id } })
      return NextResponse.json({ message: "Service deleted" })
    } catch (e) {
      return NextResponse.json({ message: "Service not found" }, { status: 404 })
    }
  } catch (error: any) {
    return NextResponse.json({ message: "Failed to delete service" }, { status: 500 })
  }
}
