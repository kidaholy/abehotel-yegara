import express, { type Request, type Response } from "express"
import { signToken } from "../../lib/auth"
import { prisma } from "../../lib/db"
import bcrypt from "bcryptjs"

const router = express.Router()

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: role || "cashier" }
    })

    const token = signToken({ id: user.id, email: user.email, role: user.role })

    res.json({ token, user: { id: user.id, name: user.name, role: user.role } })
  } catch (error) {
    res.status(500).json({ message: "Registration failed" })
  }
})

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role })

    res.json({ token, user: { id: user.id, name: user.name, role: user.role } })
  } catch (error) {
    res.status(500).json({ message: "Login failed" })
  }
})

export default router
