const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    const orderCount = await prisma.order.count();
    const itemCount = await prisma.orderItem.count();
    console.log('--- Verification Report ---');
    console.log('Total Orders in PostgreSQL:', orderCount);
    console.log('Total Order Items in PostgreSQL:', itemCount);
    console.log('---------------------------');
  } catch (err) {
    console.error('Verification failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
