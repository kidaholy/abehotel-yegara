import express, { type Request, type Response } from "express"
import { authenticate, authorize } from "../middleware/auth"
import { prisma } from "../../lib/prisma"

const router = express.Router()

router.get("/", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" }
    })
    res.json(users)
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" })
  }
})

router.put("/:id", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive }
    })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: "Failed to update user" })
  }
})

router.delete("/:id", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } })
    res.json({ message: "User deleted" })
  } catch (error) {
    res.status(500).json({ message: "Failed to delete user" })
  }
})

export default router
