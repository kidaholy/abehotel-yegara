/**
 * MongoDB Atlas Example — Hotel Order Feed (Mongoose / Node.js)
 *
 * Install dependencies:
 *   npm install mongoose dotenv
 *
 * Run:
 *   node mongodbExample.js
 *
 * Make sure MONGODB_URI is set in your .env file, e.g.:
 *   MONGODB_URI="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/abehotel"
 */

require('dotenv').config(); // Load .env so MONGODB_URI is available
const mongoose = require('mongoose');

// ── 1. Connection string ──────────────────────────────────────────────────────
// We read from env so the real URI is never hardcoded in source code.
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Add it to your .env file.');
  process.exit(1);
}

// ── 2. Define a schema ────────────────────────────────────────────────────────
// Mongoose schemas describe the shape of documents in a collection.
// This makes it easy to validate data before writing it to the database.
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true },
  tableNumber: { type: String, required: true },
  cashier:     { type: String, required: true },
  items:       [{ name: String, qty: Number, price: Number }],
  totalAmount: { type: Number, required: true },
  status:      { type: String, enum: ['pending', 'preparing', 'served', 'completed'], default: 'pending' },
  // createdAt is the timestamp we'll sort on — we set it manually so we get
  // realistic spread across documents rather than all the same time.
  createdAt:   { type: Date, required: true },
});

// The third argument 'orders' forces Mongoose to use exactly that collection name
// (by default Mongoose would pluralise the model name, which is fine, but explicit is clearer).
const Order = mongoose.model('Order', orderSchema, 'orders');

// ── 3. Seed data ──────────────────────────────────────────────────────────────
// Ten realistic hotel restaurant orders spread over the last 10 hours.
function buildSampleOrders() {
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  return [
    { orderNumber: 'ORD-001', tableNumber: 'T1',  cashier: 'Abebe',  items: [{ name: 'Tibs',      qty: 2, price: 120 }, { name: 'Tej',     qty: 1, price: 50 }],  totalAmount: 290, status: 'completed', createdAt: new Date(now - 10 * hour) },
    { orderNumber: 'ORD-002', tableNumber: 'T3',  cashier: 'Selamit', items: [{ name: 'Kitfo',     qty: 1, price: 150 }],                                           totalAmount: 150, status: 'completed', createdAt: new Date(now -  9 * hour) },
    { orderNumber: 'ORD-003', tableNumber: 'T5',  cashier: 'Abebe',  items: [{ name: 'Shiro',     qty: 3, price: 80  }, { name: 'Water',   qty: 3, price: 15 }],  totalAmount: 285, status: 'completed', createdAt: new Date(now -  8 * hour) },
    { orderNumber: 'ORD-004', tableNumber: 'T2',  cashier: 'Tigist', items: [{ name: 'Dulet',     qty: 2, price: 130 }, { name: 'Juice',   qty: 2, price: 45 }],  totalAmount: 350, status: 'completed', createdAt: new Date(now -  7 * hour) },
    { orderNumber: 'ORD-005', tableNumber: 'T7',  cashier: 'Selamit', items: [{ name: 'Firfir',   qty: 2, price: 70  }],                                           totalAmount: 140, status: 'completed', createdAt: new Date(now -  6 * hour) },
    { orderNumber: 'ORD-006', tableNumber: 'T4',  cashier: 'Tigist', items: [{ name: 'Ayibe',     qty: 1, price: 60  }, { name: 'Coffee',  qty: 2, price: 30 }],  totalAmount: 120, status: 'served',    createdAt: new Date(now -  4 * hour) },
    { orderNumber: 'ORD-007', tableNumber: 'T6',  cashier: 'Abebe',  items: [{ name: 'Gored Gored', qty: 1, price: 160 }],                                         totalAmount: 160, status: 'served',    createdAt: new Date(now -  3 * hour) },
    { orderNumber: 'ORD-008', tableNumber: 'T1',  cashier: 'Selamit', items: [{ name: 'Tibs',     qty: 1, price: 120 }, { name: 'Ambo',    qty: 2, price: 20 }],  totalAmount: 160, status: 'preparing', createdAt: new Date(now -  2 * hour) },
    { orderNumber: 'ORD-009', tableNumber: 'T8',  cashier: 'Tigist', items: [{ name: 'Injera',    qty: 4, price: 25  }, { name: 'Kitfo',   qty: 1, price: 150 }], totalAmount: 250, status: 'preparing', createdAt: new Date(now -  1 * hour) },
    { orderNumber: 'ORD-010', tableNumber: 'T2',  cashier: 'Abebe',  items: [{ name: 'Coffee',    qty: 3, price: 30  }],                                           totalAmount:  90, status: 'pending',   createdAt: new Date(now           ) },
  ];
}

// ── 4. Main function ──────────────────────────────────────────────────────────
async function main() {
  // Connect — Mongoose keeps a single shared connection for the whole process.
  console.log('🔌 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected!\n');

  // ── Insert ──────────────────────────────────────────────────────────────────
  // insertMany is one round-trip instead of ten separate inserts — much faster.
  console.log('📝 Inserting 10 sample orders...');
  const inserted = await Order.insertMany(buildSampleOrders());
  console.log(`   Inserted ${inserted.length} documents.\n`);

  // ── Read: 5 most recent ─────────────────────────────────────────────────────
  // sort({ createdAt: -1 }) = descending, so the newest comes first.
  // limit(5) means we only pull 5 documents, not the whole collection.
  console.log('📋 5 most recent orders (newest first):');
  const recent = await Order.find().sort({ createdAt: -1 }).limit(5);
  recent.forEach((o, i) => {
    console.log(`  ${i + 1}. [${o.orderNumber}] Table ${o.tableNumber} — ${o.totalAmount} ETB — ${o.status} — ${o.createdAt.toLocaleTimeString()}`);
  });
  console.log();

  // ── Read: single document by _id ────────────────────────────────────────────
  // _id is the unique identifier MongoDB assigns to every document automatically.
  // We grab the first inserted doc just to have a real ID to look up.
  const targetId = inserted[0]._id;
  console.log(`🔍 Fetching single document by _id: ${targetId}`);
  const single = await Order.findById(targetId);
  console.log('   Found:', JSON.stringify(single.toObject(), null, 2));

  // ── Close connection ─────────────────────────────────────────────────────────
  // Always disconnect when you're done — leaving the connection open would keep
  // the Node.js process alive indefinitely.
  await mongoose.disconnect();
  console.log('\n🔒 Connection closed. Done!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
