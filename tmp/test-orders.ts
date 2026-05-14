import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const d = new Date()
    const ethiopiaTime = new Date(d.getTime() + 3 * 3600 * 1000)
    const year = ethiopiaTime.getUTCFullYear()
    const month = ethiopiaTime.getUTCMonth()
    const date = ethiopiaTime.getUTCDate()
    const startOfToday = new Date(Date.UTC(year, month, date, -3, 0, 0, 0))

    let where: any = { isDeleted: { not: true } }
    where.createdAt = { gte: startOfToday }

    // Let's assume a dummy cashier ID and floor ID
    // Find a cashier user if exists
    const cashier = await prisma.user.findFirst({ where: { role: 'cashier' } })
    if (cashier) {
        where.OR = [
            { createdById: cashier.id },
            { floorId: { in: [] } } // Assuming no assigned floors
        ]
    }

    const orders = await prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
    })

    const allOrdersWhereCreatedByCashier = await prisma.order.findMany({
        where: { createdById: cashier?.id },
        orderBy: { createdAt: "desc" },
    })

    console.log("Start filter:", startOfToday)
    console.log("Found orders today length:", orders.length)
    if (orders.length > 0) {
        console.log("Oldest today order:", orders[orders.length - 1].createdAt)
    }

    console.log("All orders by cashier length:", allOrdersWhereCreatedByCashier.length)
}
main().catch(console.error).finally(() => prisma.$disconnect())
