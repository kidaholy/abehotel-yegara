require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { orderNumber: true, createdAt: true, totalAmount: true, id: true }
    });
    console.log('Latest Orders:');
    orders.forEach(o => {
      console.log(`[${o.orderNumber}] ${o.createdAt.toISOString()} - ${o.totalAmount} (ID: ${o.id})`);
    });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
