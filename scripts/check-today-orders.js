require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const today = new Date('2026-05-01');
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: today } },
    select: { id: true, orderNumber: true, createdAt: true, totalAmount: true }
  });

  console.log(`Orders created on or after May 1st: ${orders.length}`);
  orders.forEach(o => {
    console.log(`- Num: ${o.orderNumber}, ID: ${o.id}, Date: ${o.createdAt}, Amount: ${o.totalAmount}`);
  });
  
  await prisma.$disconnect();
}

run().catch(console.error);
