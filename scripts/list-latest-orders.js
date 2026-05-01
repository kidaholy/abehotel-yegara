require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const latest = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, orderNumber: true, createdAt: true, totalAmount: true }
  });

  console.log('--- Latest 20 Orders in PostgreSQL ---');
  latest.forEach(o => {
    console.log(`- Num: ${o.orderNumber}, ID: ${o.id}, Date: ${o.createdAt}, Amount: ${o.totalAmount}`);
  });
  
  await prisma.$disconnect();
}

run().catch(console.error);
