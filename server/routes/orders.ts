import express, { type Request, type Response } from "express"
import { authenticate, authorize } from "../middleware/auth"
import { prisma } from "../../lib/prisma"

const router = express.Router()

router.post("/", authenticate, authorize("cashier"), async (req: Request, res: Response) => {
  try {
    const { items, totalAmount, paymentMethod, tableNumber } = req.body

    const order = await prisma.order.create({
      data: {
        orderNumber: "ORD-" + Date.now(),
        totalAmount,
        paymentMethod,
        tableNumber,
        status: "pending",
        createdById: req.userId,
        items: {
          create: items
        }
      }
    })

    res.status(201).json(order)
  } catch (error) {
    res.status(500).json({ message: "Failed to create order" })
  }
})

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const where: any = {}
    if (req.role === "chef") {
      where.status = { not: "completed" }
    }
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: true }
    })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch orders" })
  }
})

router.put("/:id/status", authenticate, async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status }
    })
    res.json(order)
  } catch (error) {
    res.status(500).json({ message: "Failed to update order status" })
  }
})

export default router
