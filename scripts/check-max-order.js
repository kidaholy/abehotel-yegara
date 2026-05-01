const fs = require('fs');
const path = require('path');
const { BSON } = require('bson');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BACKUP_FILE = path.join(__dirname, '..', 'public', 'backup_20260430_212614');

function getMaxOrderNumber(buffer) {
  let max = 0;
  let inTargetCollection = false;
  let count = 0;

  let i = 0;
  while (i < buffer.length) {
    if (i + 4 > buffer.length) break;
    const docSize = buffer.readInt32LE(i);
    const docBuffer = buffer.slice(i, i + docSize);
    let doc;
    try { doc = BSON.deserialize(docBuffer); } catch { i++; continue; }

    if (doc.db && doc.collection) {
      inTargetCollection = doc.collection === 'orders';
      i += docSize; continue;
    }

    if (inTargetCollection && doc.orderNumber) {
      count++;
      const num = parseInt(doc.orderNumber.replace(/[^0-9]/g, ''));
      if (!isNaN(num) && num > max) max = num;
    }
    i += docSize;
  }
  return { max, count };
}

async function compare() {
  const buffer = fs.readFileSync(BACKUP_FILE);
  const mongo = getMaxOrderNumber(buffer);
  
  const pgOrders = await prisma.order.findMany({ select: { orderNumber: true } });
  let pgMax = 0;
  pgOrders.forEach(o => {
    const num = parseInt(o.orderNumber.replace(/[^0-9]/g, ''));
    if (!isNaN(num) && num > pgMax) pgMax = num;
  });

  console.log('--- Order Count & Sequence Report ---');
  console.log(`MongoDB Stats: Count=${mongo.count}, MaxNum=${mongo.max}`);
  console.log(`PostgreSQL Stats: Count=${pgOrders.length}, MaxNum=${pgMax}`);
  
  if (pgOrders.length > mongo.count) {
    console.log(`\n⚠️ PostgreSQL has ${pgOrders.length - mongo.count} extra orders.`);
  }

  // Find the highest numbered orders in PG
  const sortedPg = pgOrders
    .map(o => ({ num: parseInt(o.orderNumber.replace(/[^0-9]/g, '')), raw: o.orderNumber }))
    .filter(o => !isNaN(o.num))
    .sort((a, b) => b.num - a.num);
  
  console.log('\nLast 5 Orders in PostgreSQL:');
  sortedPg.slice(0, 5).forEach(o => console.log(`   - ${o.raw}`));

  await prisma.$disconnect();
}

compare().catch(console.error);
