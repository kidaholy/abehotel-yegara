import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const decoded = await validateSession(request)
    if (decoded.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    const services = await prisma.service.findMany({
      orderBy: [ { category: 'asc' }, { name: 'asc' } ]
    })
    return NextResponse.json(services.map(s => ({ ...s, _id: s.id })))
  } catch (error: any) {
    return NextResponse.json({ message: "Failed to get services" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const decoded = await validateSession(request)
    if (decoded.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const { name, description, category, price, unit, isAvailable, icon } = body
    if (!name || !category || price === undefined) {
      return NextResponse.json({ message: "Name, category, and price are required" }, { status: 400 })
    }
    const service = await prisma.service.create({
      data: { name, description, category, price, unit, isAvailable: isAvailable ?? true, icon: icon || "🛎️" }
    })
    return NextResponse.json({ message: "Service created", service: { ...service, _id: service.id } })
  } catch (error: any) {
    return NextResponse.json({ message: "Failed to create service" }, { status: 500 })
  }
}
