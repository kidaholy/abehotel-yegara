import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const decoded = await validateSession(request)
    if (decoded.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "month"
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    const now = new Date()
    let startDate: Date
    let endDate: Date | null = null

    if (startDateParam) {
      // Explicit date range
      startDate = new Date(startDateParam)
      endDate = endDateParam ? new Date(endDateParam) : null
    } else if (period === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === "week") {
      startDate = new Date(now); startDate.setDate(now.getDate() - 7)
    } else if (period === "year") {
      startDate = new Date(now.getFullYear(), 0, 1)
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const dateFilter: any = { gte: startDate }
    if (endDate) dateFilter.lte = endDate

    // Fetch active/pending bookings by creation date
    const activeBookings = await prisma.receptionRequest.findMany({
      where: {
        status: { in: [
          "CHECKIN_APPROVED", "ACTIVE", "CHECKOUT_PENDING", "CHECKOUT_APPROVED",
          "guests" as any, "check_in" as any
        ]},
        inquiryType: { in: ["check_in", "check_out", "reservation"] },
        createdAt: dateFilter,
      }
    })

    // Fetch CHECKED_OUT bookings by checkOut date (revenue realized on departure)
    const checkedOutBookings = await prisma.receptionRequest.findMany({
      where: {
        status: { in: ["CHECKED_OUT", "check_out" as any] },
        inquiryType: { in: ["check_in", "check_out", "reservation"] },
      }
    })

    // Filter checked-out bookings to the selected period using their checkOut date
    const filteredCheckedOut = checkedOutBookings.filter((b: any) => {
      if (!b.checkOut) return false
      const checkOutDate = new Date(b.checkOut)
      if (checkOutDate < startDate) return false
      if (endDate && checkOutDate > endDate) return false
      return true
    })

    // Merge, de-duplicating by id
    const checkedOutIds = new Set(filteredCheckedOut.map((b: any) => b.id))
    const bookings = [
      ...activeBookings.filter((b: any) => !checkedOutIds.has(b.id)),
      ...filteredCheckedOut
    ]

    const calcNights = (checkIn?: string, checkOut?: string): number => {
      if (!checkIn || !checkOut) return 1
      const msPerDay = 1000 * 60 * 60 * 24
      const diff = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay)
      return diff > 0 ? diff : 1
    }

    const totalRevenue = bookings.reduce((sum, b) => {
      const nights = calcNights(b.checkIn as string | undefined, b.checkOut as string | undefined)
      return sum + (Number(b.roomPrice) || 0) * nights
    }, 0)
    const totalBookings = bookings.length

    const byRoom = bookings.reduce((acc: any, b) => {
      const key = b.roomNumber || "Unknown"
      const nights = calcNights(b.checkIn as string | undefined, b.checkOut as string | undefined)
      if (!acc[key]) acc[key] = { roomNumber: key, bookings: 0, revenue: 0 }
      acc[key].bookings++
      acc[key].revenue += (Number(b.roomPrice) || 0) * nights
      return acc
    }, {})

    const byPayment = bookings.reduce((acc: any, b) => {
      const key = b.paymentMethod || "cash"
      const nights = calcNights(b.checkIn as string | undefined, b.checkOut as string | undefined)
      if (!acc[key]) acc[key] = { method: key, count: 0, revenue: 0 }
      acc[key].count++
      acc[key].revenue += (Number(b.roomPrice) || 0) * nights
      return acc
    }, {})

    return NextResponse.json({
      totalRevenue,
      totalBookings,
      byRoom: Object.values(byRoom),
      byPayment: Object.values(byPayment),
      bookings: bookings.map((b: any) => ({
        _id: b.id,
        guestName: b.guestName,
        roomNumber: b.roomNumber,
        roomPrice: b.roomPrice,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        nights: calcNights(b.checkIn as string | undefined, b.checkOut as string | undefined),
        totalAmount: (Number(b.roomPrice) || 0) * calcNights(b.checkIn as string | undefined, b.checkOut as string | undefined),
        paymentMethod: b.paymentMethod,
        createdAt: b.createdAt,
      }))
    })
  } catch (error: any) {
    console.error("Bedroom revenue report error:", error)
    return NextResponse.json({ message: "Failed" }, { status: 500 })
  }
}
