import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

// GET all requests (admin) or own submissions (reception)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500) // Max 500
    const skip = Number(searchParams.get('skip')) || 0
    const status = searchParams.get('status') // Filter by status
    const searchTerm = searchParams.get('search') // Search by name/phone/room
    
    const decoded = await validateSession(request)

    let where: any = {}
    let andConditions: any[] = []
    
    // Build query based on role
    if (decoded.role === "admin") {
      // Admin sees all requests
      if (status && status !== "all") {
        if (status === "pending") {
          andConditions.push({ status: { in: ["CHECKIN_PENDING", "CHECKOUT_PENDING", "EXTEND_PENDING", "pending"] } })
        } else if (status === "check_in" || status === "guests") {
          andConditions.push({ status: { in: ["CHECKIN_APPROVED", "check_in", "ACTIVE", "guests"] } })
        } else if (status === "check_out") {
          andConditions.push({ status: { in: ["CHECKED_OUT", "CHECKOUT_APPROVED", "check_out"] } })
        } else if (status === "rejected") {
          andConditions.push({ status: { in: ["REJECTED", "rejected"] } })
        } else {
          andConditions.push({ status })
        }
      }
    } else if (decoded.role === "reception") {
      // Reception staff sees all approved guests + their own submissions
      andConditions.push({
        OR: [
          { submittedBy: decoded.id },
          { status: { in: ["CHECKIN_APPROVED", "CHECKOUT_PENDING", "CHECKED_OUT", "CHECKOUT_APPROVED", "ACTIVE", "guests", "check_in", "check_out", "REJECTED", "rejected"] } }
        ]
      })
      if (status && status !== "all") {
        if (status === "pending") {
           andConditions.push({ status: { in: ["CHECKIN_PENDING", "CHECKOUT_PENDING", "EXTEND_PENDING", "pending"] } })
        } else if (status === "check_in" || status === "guests") {
           andConditions.push({ status: { in: ["CHECKIN_APPROVED", "check_in", "ACTIVE", "guests"] } })
        } else if (status === "check_out") {
           andConditions.push({ status: { in: ["CHECKED_OUT", "CHECKOUT_APPROVED", "check_out"] } })
        } else {
           andConditions.push({ status })
        }
      }
    } else {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    // Search filter
    if (searchTerm) {
      andConditions.push({
        OR: [
          { guestName: { contains: searchTerm, mode: 'insensitive' } },
          { phone: { contains: searchTerm, mode: 'insensitive' } },
          { roomNumber: { contains: searchTerm, mode: 'insensitive' } },
          { faydaId: { contains: searchTerm, mode: 'insensitive' } }
        ]
      })
    }

    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    // Execute query with pagination
    const requests = await prisma.receptionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: skip,
      select: {
        id: true,
        guestName: true,
        faydaId: true,
        phone: true,
        photoUrl: true,
        floorId: true,
        roomNumber: true,
        roomPrice: true,
        inquiryType: true,
        checkIn: true,
        checkOut: true,
        checkInTime: true,
        checkOutTime: true,
        guests: true,
        paymentMethod: true,
        chequeNumber: true,
        paymentReference: true,
        transactionUrl: true,
        notes: true,
        status: true,
        submittedBy: true,
        reviewedBy: true,
        reviewNote: true,
        createdAt: true,
        updatedAt: true,
        originalCheckOut: true
      }
    })

    // Get total count for pagination
    const total = await prisma.receptionRequest.count({ where })

    // Calculate global overdue count
    const todayStr = new Date().toISOString().split('T')[0]
    const overdueCount = await prisma.receptionRequest.count({
      where: {
        status: { in: ["CHECKIN_APPROVED", "ACTIVE", "guests", "check_in"] },
        checkOut: { lt: todayStr }
      }
    })

    return NextResponse.json({
      data: requests.map(r => ({ ...r, _id: r.id })),
      total,
      overdueCount,
      limit,
      skip,
      hasMore: skip + limit < total
    })
  } catch (error: any) {
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to get requests" }, { status })
  }
}

// POST - reception staff submits a new request
export async function POST(request: Request) {
  try {
    const decoded = await validateSession(request)
    if (!["reception", "admin"].includes(decoded.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { guestName, faydaId, phone, idPhotoFront, idPhotoBack, photoUrl, floorId, roomNumber, roomPrice,
            inquiryType, checkIn, checkOut, checkInTime, checkOutTime, guests, paymentMethod, chequeNumber, paymentReference, transactionUrl, notes } = body

    if (!guestName || !inquiryType) {
      return NextResponse.json({ message: "Guest name and inquiry type are required" }, { status: 400 })
    }

    if (!phone || !String(phone).trim()) {
      return NextResponse.json({ message: "Phone number is required" }, { status: 400 })
    }

    if (!idPhotoFront || !idPhotoBack) {
      return NextResponse.json({ message: "Front and back guest ID photos are required" }, { status: 400 })
    }

    if (!floorId || !roomNumber) {
      return NextResponse.json({ message: "Floor and room are required" }, { status: 400 })
    }

    if (!guests) {
      return NextResponse.json({ message: "Guest number is required" }, { status: 400 })
    }

    if (!checkIn || !checkOut) {
      return NextResponse.json({ message: "Check-in and check-out dates are required" }, { status: 400 })
    }

    if (paymentMethod === "cash" && (!paymentReference || !String(paymentReference).trim())) {
      return NextResponse.json({ message: "Receipt number is required for cash payment" }, { status: 400 })
    }

    if (paymentMethod !== "cash" && (!transactionUrl || !String(transactionUrl).trim())) {
      return NextResponse.json({ message: "Receipt URL is required for non-cash payments" }, { status: 400 })
    }

    const doc = await prisma.receptionRequest.create({
      data: {
        guestName, faydaId, phone, idPhotoFront, idPhotoBack, photoUrl, floorId, roomNumber, roomPrice,
        inquiryType, checkIn, checkOut, checkInTime, checkOutTime, guests, paymentMethod, chequeNumber, paymentReference, transactionUrl, notes,
        status: (inquiryType === "check_out" ? "CHECKOUT_PENDING" : "CHECKIN_PENDING") as any,
        submittedBy: decoded.id
      }
    })

    return NextResponse.json({ message: "Request submitted", request: { ...doc, _id: doc.id } })
  } catch (error: any) {
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to submit request" }, { status })
  }
}

// DELETE all requests (Admin only)
export async function DELETE(request: Request) {
  try {
    const decoded = await validateSession(request)
    if (decoded.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
    
    await prisma.receptionRequest.deleteMany({})

    return NextResponse.json({ message: "All reception requests deleted successfully." })
  } catch (error: any) {
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to delete requests" }, { status })
  }
}
