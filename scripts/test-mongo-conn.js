const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
console.log('Trying URI:', uri);

async function test() {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('✅ Connected! Collections:', collections.map(c => c.name));
    const orderCount = await db.collection('orders').countDocuments();
    console.log('📦 Order count:', orderCount);
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}

test();
