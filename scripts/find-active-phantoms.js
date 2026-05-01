require('dotenv').config();
const fs = require('fs');
const { BSON } = require('bson');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BACKUP_FILE = 'public/backup_20260430_212614';

function getMongoIds(buffer) {
  const ids = new Set();
  let i = 0;
  let inOrders = false;
  while (i < buffer.length) {
    if (i + 4 > buffer.length) break;
    const docSize = buffer.readInt32LE(i);
    const doc = BSON.deserialize(buffer.slice(i, i + docSize));
    if (doc.db && doc.collection) { inOrders = doc.collection === 'orders'; i += docSize; continue; }
    if (inOrders && doc._id) ids.add(doc._id.toString());
    i += docSize;
  }
  return ids;
}

async function run() {
  const buffer = fs.readFileSync(BACKUP_FILE);
  const mongoIds = getMongoIds(buffer);
  
  const pgOrders = await prisma.order.findMany({
    select: { id: true, orderNumber: true, createdAt: true }
  });

  const phantoms = pgOrders.filter(o => !mongoIds.has(o.id));
  
  console.log('--- Phantom Orders in Active Range ---');
  phantoms.forEach(o => {
    const num = parseInt(o.orderNumber.replace(/[^0-9]/g, ''));
    if (num > 3000 && num <= 3823) {
      console.log(`❌ Phantom Found: Num ${o.orderNumber}, ID: ${o.id}, Date: ${o.createdAt}`);
    }
  });

  await prisma.$disconnect();
}

run().catch(console.error);
