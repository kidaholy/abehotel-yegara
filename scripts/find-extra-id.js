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
  let inTargetCollection = false;
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
    if (inTargetCollection && doc._id) {
        ids.add(doc._id.toString());
    }
    i += docSize;
  }
  return ids;
}

async function run() {
  const buffer = fs.readFileSync(BACKUP_FILE);
  const mongoIds = getMongoIds(buffer);
  const pgOrders = await prisma.order.findMany({ select: { id: true, orderNumber: true, createdAt: true } });

  const extraInPg = pgOrders.filter(o => !mongoIds.has(o.id));
  
  console.log(`--- Comparison Result ---`);
  console.log(`PG Total: ${pgOrders.length}`);
  console.log(`Mongo Backup Total: ${mongoIds.size}`);
  
  if (extraInPg.length > 0) {
    console.log(`\n❌ Found ${extraInPg.length} orders in PostgreSQL that are NOT in the BSON backup:`);
    extraInPg.sort((a,b) => b.createdAt - a.createdAt).slice(0, 10).forEach(o => {
        console.log(`   - Num: ${o.orderNumber}, ID: ${o.id}, Date: ${o.createdAt}`);
    });
  } else {
      console.log('✅ All PG orders are present in the Mongo backup.');
  }
  await prisma.$disconnect();
}

run().catch(console.error);
