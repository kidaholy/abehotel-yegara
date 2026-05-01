require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('🔍 Checking for identical content duplicates...');
  
  const pgOrders = await prisma.order.findMany({
    select: { id: true, orderNumber: true, createdAt: true, totalAmount: true }
  });

  const seen = new Map();
  const dupes = [];

  pgOrders.forEach(o => {
    const key = `${o.createdAt.toISOString()}_${o.totalAmount}`;
    if (seen.has(key)) {
      dupes.push({ original: seen.get(key), duplicate: o });
    } else {
      seen.set(key, o);
    }
  });

  if (dupes.length === 0) {
    console.log('✅ No identical content duplicates found.');
  } else {
    console.log(`❌ Found ${dupes.length} potential content-identical duplicate(s):`);
    dupes.forEach((d, i) => {
      console.log(`\nGroup ${i+1}:`);
      console.log(`   [A] Num: ${d.original.orderNumber}, ID: ${d.original.id}, Date: ${d.original.createdAt.toISOString()}, Amount: ${d.original.totalAmount}`);
      console.log(`   [B] Num: ${d.duplicate.orderNumber}, ID: ${d.duplicate.id}, Date: ${d.duplicate.createdAt.toISOString()}, Amount: ${d.duplicate.totalAmount}`);
    });
  }

  await prisma.$disconnect();
}

run().catch(console.error);
