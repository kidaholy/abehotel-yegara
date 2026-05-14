import { PrismaClient } from "@prisma/client"
import { getStartOfTodayUTC3 } from "@/lib/time-sync"

const prisma = new PrismaClient({ log: ['query'] })

async function main() {
    const todayStart = getStartOfTodayUTC3()
    
    console.log("Running Raw Query...")
    const rawOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: todayStart }
      }
    })
    console.log("Raw Orders:", rawOrders.length)
    
    console.log("Running OR Query...")
    const orOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: todayStart },
        OR: [
          { status: "completed" },
          { status: "preparing" }
        ]
      }
    })
    console.log("OR Orders:", orOrders.length)
}

main().catch(console.error).finally(() => prisma.$disconnect())
