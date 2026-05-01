const fs = require('fs');
const path = require('path');
const { BSON } = require('bson');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BACKUP_FILE = path.join(__dirname, '..', 'public', 'backup_20260430_212614');

function extractOrderNumbers(buffer) {
  const nums = new Set();
  const ids = new Set();
  let i = 0;
  let inTargetCollection = false;

  while (i < buffer.length) {
    if (i + 4 > buffer.length) break;
    const docSize = buffer.readInt32LE(i);
    if (docSize < 5 || docSize > 16 * 1024 * 1024 || i + docSize > buffer.length) {
      i++; continue;
    }
    const docBuffer = buffer.slice(i, i + docSize);
    let doc;
    try { doc = BSON.deserialize(docBuffer); } 
    catch { i++; continue; }

    if (doc.db && doc.collection) {
      inTargetCollection = doc.collection === 'orders';
      i += docSize; continue;
    }

    if (inTargetCollection && doc._id) {
      ids.add(doc._id.toString());
      if (doc.orderNumber) nums.add(doc.orderNumber);
    }
    i += docSize;
  }
  return { ids, nums };
}

async function findExtra() {
  console.log('📖 Reading backup file...');
  const buffer = fs.readFileSync(BACKUP_FILE);
  const { ids: mongoIds, nums: mongoNums } = extractOrderNumbers(buffer);
  console.log(`✅ MongoDB Backup: ${mongoIds.size} unique IDs, ${mongoNums.size} unique Order Numbers`);

  console.log('🔗 Fetching PostgreSQL orders...');
  const pgOrders = await prisma.order.findMany({ select: { id: true, orderNumber: true } });
  console.log(`✅ PostgreSQL Orders: ${pgOrders.length}`);

  console.log('\n--- Discrepancy Analysis ---');
  
  // Find IDs in PG not in Mongo
  const extraInPg = pgOrders.filter(o => !mongoIds.has(o.id));
  if (extraInPg.length > 0) {
    console.log(`❌ Found ${extraInPg.length} orders in PG that are NOT in the BSON backup:`);
    extraInPg.forEach(o => console.log(`   - ID: ${o.id}, Number: ${o.orderNumber}`));
  } else {
    console.log('✅ No unique IDs in PG that are missing from Mongo.');
  }

  // Check for OrderNumber duplications in PG
  const numCounts = new Map();
  pgOrders.forEach(o => {
    numCounts.set(o.orderNumber, (numCounts.get(o.orderNumber) || 0) + 1);
  });
  const duplicates = [...numCounts.entries()].filter(([num, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`\n❌ Found ${duplicates.length} duplicate Order Numbers in PG:`);
    duplicates.forEach(([num, count]) => console.log(`   - ${num}: ${count} times`));
  } else {
    console.log('✅ No duplicate Order Numbers in PG.');
  }

  await prisma.$disconnect();
}

findExtra().catch(console.error);
