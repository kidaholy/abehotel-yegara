require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('abehotel');
    const count = await db.collection('orders').countDocuments();
    console.log(`Live MongoDB Order Count: ${count}`);
    
    const latest = await db.collection('orders').find().sort({ createdAt: -1 }).limit(1).toArray();
    if (latest.length > 0) {
        console.log(`Live Mongo Latest Order #: ${latest[0].orderNumber}, Created: ${latest[0].createdAt}`);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.close();
  }
}

run();
