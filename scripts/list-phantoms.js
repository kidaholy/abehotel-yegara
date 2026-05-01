require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { BSON } = require('bson');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BACKUP_FILE = path.join(__dirname, '..', 'public', 'backup_20260430_212614');

function getMongoIds(buffer) {
  const ids = new Set();
  let i = 0;
  let inOrders = false;
  while (i < buffer.length) {
    if (i + 4 > buffer.length) break;
    const docSize = buffer.readInt32LE(i);
    const docBuffer = buffer.slice(i, i + docSize);
    let doc;
    try { doc = BSON.deserialize(docBuffer); } catch { i++; continue; }
    if (doc.db && doc.collection) {
      inOrders = doc.collection === 'orders';
      i += docSize; continue;
    }
    if (inOrders && doc._id) {
        ids.add(doc._id.toString());
    }
    i += docSize;
  }
  return ids;
}

async function run() {
  const buffer = fs.readFileSync(BACKUP_FILE);
  const mongoIds = getMongoIds(buffer);
  
  // Find all orders in PG
  const pgOrders = await prisma.order.findMany({ 
    select: { id: true, orderNumber: true, createdAt: true, totalAmount: true } 
  });

  const extras = pgOrders.filter(o => !mongoIds.has(o.id));
  
  console.log(`--- Potential Phantom Orders (In PG but not in Backup) ---`);
  console.log(`Total Extra Records: ${extras.length}`);
  
  // Look for ones with high numbers or suspicious timestamps
  const suspicious = extras.sort((a,b) => b.createdAt - a.createdAt);
  
  console.log('\nTop 20 most recent extra orders:');
  suspicious.slice(0, 20).forEach(o => {
    console.log(`- Num: ${o.orderNumber}, Date: ${o.createdAt.toISOString()}, Amount: ${o.totalAmount}, ID: ${o.id}`);
  });

  await prisma.$disconnect();
}

run().catch(console.error);
