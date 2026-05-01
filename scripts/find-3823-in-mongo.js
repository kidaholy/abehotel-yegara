const fs = require('fs');
const { BSON } = require('bson');
const BACKUP_FILE = 'public/backup_20260430_212614';

async function run() {
  const buffer = fs.readFileSync(BACKUP_FILE);
  let i = 0;
  let inOrders = false;
  let found = false;
  while (i < buffer.length) {
    if (i + 4 > buffer.length) break;
    const docSize = buffer.readInt32LE(i);
    if (docSize < 5 || i + docSize > buffer.length) { i++; continue; }
    
    const docBuffer = buffer.slice(i, i + docSize);
    let doc;
    try { doc = BSON.deserialize(docBuffer); } catch { i++; continue; }

    if (doc.db && doc.collection) {
      inOrders = doc.collection === 'orders';
      i += docSize; continue;
    }

    if (inOrders && doc.orderNumber === '3823') {
      console.log('✅ FOUND 3823 in Mongo BSON!');
      console.log('ID:', doc._id.toString());
      found = true;
    }
    i += docSize;
  }
  if (!found) console.log('❌ 3823 NOT FOUND in Mongo BSON.');
}

run().catch(console.error);
