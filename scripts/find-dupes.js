require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findDupes() {
  console.log('🔍 Scanning PostgreSQL for duplicate Order Numbers...');
  
  const dupes = await prisma.order.groupBy({
    by: ['orderNumber'],
    _count: {
      orderNumber: true,
    },
    having: {
      orderNumber: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  if (dupes.length === 0) {
    console.log('✅ No duplicate Order Numbers found.');
  } else {
    console.log(`❌ Found ${dupes.length} duplicate group(s):`);
    for (const d of dupes) {
      console.log(`\nDuplicate: ${d.orderNumber} (Count: ${d._count.orderNumber})`);
      const orders = await prisma.order.findMany({
        where: { orderNumber: d.orderNumber },
        select: { id: true, createdAt: true, totalAmount: true }
      });
      orders.forEach((o, i) => {
        console.log(`   [${i+1}] ID: ${o.id}, Created: ${o.createdAt}, Amount: ${o.totalAmount}`);
      });
    }
  }

  await prisma.$disconnect();
}

findDupes().catch(console.error);
