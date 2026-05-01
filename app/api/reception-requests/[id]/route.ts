import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateSession } from "@/lib/auth"

export async function GET(request: Request, context: any) {
  try {
    const { id } = await context.params
    const decoded = await validateSession(request)
    if (!["admin", "reception"].includes(decoded.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const doc = await prisma.receptionRequest.findUnique({ where: { id } })
    if (!doc) return NextResponse.json({ message: "Request not found" }, { status: 404 })

    return NextResponse.json({ ...doc, _id: doc.id })
  } catch (error: any) {
    return NextResponse.json({ message: "Failed to get request" }, { status: 500 })
  }
}

export async function PUT(request: Request, context: any) {
  try {
    const { id } = await context.params
    const decoded = await validateSession(request)
    const body = await request.json()
    const { status, reviewNote, checkOut, inquiryType } = body

    if (decoded.role === "reception") {
      const isCheckoutRequest = inquiryType === "check_out" || status === "CHECKOUT_PENDING"
      const isExtendRequest = status === "EXTEND_PENDING"

      if (!isCheckoutRequest && !isExtendRequest) {
        return NextResponse.json({ message: "Reception can only request checkout or extension approval" }, { status: 403 })
      }

      const update: any = {
        reviewNote: reviewNote || "",
        ...(checkOut ? { checkOut: new Date(checkOut) } : {}),
      }

      if (isCheckoutRequest) {
        update.status = "CHECKOUT_PENDING"
        update.inquiryType = "check_out"
      } else {
        update.status = "EXTEND_PENDING"
      }

      try {
        const updated = await prisma.receptionRequest.update({ where: { id }, data: update })
        return NextResponse.json({
          message: isCheckoutRequest ? "Checkout requested" : "Extension requested",
          request: { ...updated, _id: updated.id }
        })
      } catch (e) {
        return NextResponse.json({ message: "Request not found" }, { status: 404 })
      }
    }

    if (decoded.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    if (!["CHECKIN_PENDING", "CHECKIN_APPROVED", "EXTEND_PENDING", "CHECKOUT_PENDING", "CHECKOUT_APPROVED", "CHECKED_OUT", "REJECTED", "guests", "rejected", "check_in", "check_out", "pending", "ACTIVE"].includes(status)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 })
    }

    const currentRequest = await prisma.receptionRequest.findUnique({ where: { id } })
    if (!currentRequest) return NextResponse.json({ message: "Request not found" }, { status: 404 })

    const effectiveInquiryType = inquiryType || currentRequest.inquiryType

    if (
      effectiveInquiryType === "check_out" &&
      ["CHECKIN_PENDING", "CHECKIN_APPROVED", "check_in"].includes(status) &&
      !(currentRequest.status === "CHECKOUT_PENDING" && status === "CHECKIN_APPROVED")
    ) {
      return NextResponse.json({ message: "ERROR: Checkout requests cannot be set to check-in status (except denying checkout)." }, { status: 400 })
    }

    if (
      effectiveInquiryType === "check_in" &&
      ["CHECKOUT_PENDING", "CHECKOUT_APPROVED", "CHECKED_OUT", "check_out"].includes(status) &&
      inquiryType !== "check_out"
    ) {
      return NextResponse.json({ message: "ERROR: Set inquiryType to check_out before requesting checkout." }, { status: 400 })
    }

    let targetStatus = status

    if (currentRequest.status === "CHECKOUT_PENDING") {
      if (status === "CHECKOUT_APPROVED") targetStatus = "CHECKED_OUT"
      if (status === "REJECTED" || status === "rejected") targetStatus = "CHECKIN_APPROVED"
    }

    if (currentRequest.status === "EXTEND_PENDING") {
      if (status === "CHECKIN_APPROVED") targetStatus = "CHECKIN_APPROVED"
      if (status === "REJECTED" || status === "rejected") targetStatus = "CHECKIN_APPROVED"
    }

    const updateAdmin: any = {
      status: targetStatus,
      reviewNote: reviewNote || "",
      reviewedBy: decoded.id,
      ...(inquiryType ? { inquiryType } : {}),
      ...(checkOut ? { checkOut: new Date(checkOut) } : {}),
    }

    const updated = await prisma.receptionRequest.update({ where: { id }, data: updateAdmin })

    if (targetStatus === "CHECKED_OUT" && updated.roomNumber) {
      const room = await prisma.room.findFirst({ where: { roomNumber: updated.roomNumber } })
      if (room) {
        await prisma.room.update({ where: { id: room.id }, data: { status: "available" } })
      }
    }

    return NextResponse.json({ message: `Request ${targetStatus}`, request: { ...updated, _id: updated.id } })
  } catch (error: any) {
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to update request" }, { status })
  }
}

export async function DELETE(request: Request, context: any) {
  try {
    const { id } = await context.params
    const decoded = await validateSession(request)
    if (decoded.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    try {
      await prisma.receptionRequest.delete({ where: { id } })
      return NextResponse.json({ message: "Request deleted successfully" })
    } catch (e) {
      return NextResponse.json({ message: "Request not found" }, { status: 404 })
    }
  } catch (error: any) {
    const status = error.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ message: "Failed to delete request" }, { status })
  }
}
