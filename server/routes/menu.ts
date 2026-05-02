import express, { type Request, type Response } from "express"
import { authenticate, authorize } from "../middleware/auth"
import { db } from "../../lib/json-db"

const router = express.Router()

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const items = await db.menuItem.findMany()
    res.json(items)
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch menu items" })
  }
})

router.post("/", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  try {
    const item = await db.menuItem.create({ data: req.body })
    res.status(201).json(item)
  } catch (error) {
    res.status(500).json({ message: "Failed to create menu item" })
  }
})

router.put("/:id", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  try {
    const item = await db.menuItem.update({ 
      where: { id: req.params.id }, 
      data: req.body 
    })
    res.json(item)
  } catch (error) {
    res.status(500).json({ message: "Failed to update menu item" })
  }
})

router.delete("/:id", authenticate, authorize("admin"), async (req: Request, res: Response) => {
  try {
    await db.menuItem.delete({ where: { id: req.params.id } })
    res.json({ message: "Menu item deleted" })
  } catch (error) {
    res.status(500).json({ message: "Failed to delete menu item" })
  }
})

export default router
