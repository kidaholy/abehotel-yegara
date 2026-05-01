const fs = require('fs');
const { BSON } = require('bson');
const BACKUP_FILE = 'public/backup_20260430_212614';

function checkNumbers(numsToCheck) {
  const buffer = fs.readFileSync(BACKUP_FILE);
  const found = new Set();
  let i = 0;
  let inOrders = false;
  while(i < buffer.length) {
    const docSize = buffer.readInt32LE(i);
    const doc = BSON.deserialize(buffer.slice(i, i + docSize));
    if (doc.collection === 'orders') { inOrders = true; i += docSize; continue; }
    if (inOrders && doc.orderNumber && numsToCheck.includes(doc.orderNumber)) {
      found.add(doc.orderNumber);
      console.log(`Found ${doc.orderNumber} in Mongo. ID: ${doc._id}`);
    }
    i += docSize;
  }
  return found;
}

checkNumbers(['3810', '3811', '3812', '3822', '3823']);
