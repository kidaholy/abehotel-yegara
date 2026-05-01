const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'backup_20260430_190328');
const buffer = fs.readFileSync(filePath);

// Print first 500 bytes as text
console.log('=== First 500 chars as text ===');
console.log(buffer.toString('utf8', 0, 500));
console.log('\n=== First 16 bytes as hex ===');
console.log(buffer.slice(0, 16).toString('hex'));
console.log('\n=== File size:', buffer.length, 'bytes');
