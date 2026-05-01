/**
 * Comprehensive migration script from mongodump BSON archive to PostgreSQL/Prisma.
 * Handles all core collections with dependency ordering and FK validation.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { BSON } = require('bson');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BACKUP_FILE = path.join(__dirname, '..', 'public', 'backup_20260430_212614');

// Valid enum values from the Prisma schema
const VALID_USER_ROLE = ['admin', 'cashier', 'chef', 'bar', 'display', 'store_keeper', 'reception', 'custom', 'super_admin'];
const VALID_FLOOR_TYPE = ['standard', 'vip'];
const VALID_MENU_TIER = ['standard', 'vip1', 'vip2'];
const VALID_TABLE_STATUS = ['active', 'inactive', 'maintenance'];
const VALID_ORDER_STATUS = ['unconfirmed', 'pending', 'preparing', 'ready', 'served', 'completed', 'cancelled'];
const VALID_STOCK_UNIT_TYPE = ['weight', 'volume', 'count'];
const VALID_STOCK_STATUS = ['active', 'finished', 'out_of_stock'];
const VALID_CATEGORY_TYPE = ['menu', 'stock', 'fixed_asset', 'expense', 'room', 'service', 'vip1_menu', 'vip2_menu', 'distribution'];
const VALID_SETTINGS_TYPE = ['string', 'url', 'boolean', 'number'];
const VALID_FIXED_ASSET_STATUS = ['active', 'partially_dismissed', 'fully_dismissed'];
const VALID_TRANSFER_STATUS = ['pending', 'approved', 'denied'];
const VALID_STORE_LOG_TYPE = ['PURCHASE', 'TRANSFER_OUT', 'ADJUSTMENT'];
const VALID_ROOM_TYPE = ['standard', 'deluxe', 'suite', 'other'];
const VALID_ROOM_STATUS = ['available', 'occupied', 'maintenance', 'dirty'];
const VALID_RECEPTION_REQUEST_STATUS = ['CHECKIN_PENDING', 'CHECKIN_APPROVED', 'EXTEND_PENDING', 'CHECKOUT_PENDING', 'CHECKOUT_APPROVED', 'CHECKED_OUT', 'REJECTED', 'ACTIVE'];
const VALID_MAIN_CATEGORY = ['Food', 'Drinks'];

// Helper to ensure values match Prisma enums
const safeEnum = (val, validList, fallback) => {
  if (!val) return fallback;
  const match = validList.find(e => e.toLowerCase() === val.toString().toLowerCase());
  return match || fallback;
};

// Retry wrapper for Supabase transient drops
async function withRetry(fn, retries = 10, delayMs = 10000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      // If it's a unique constraint error (P2002), don't retry, just throw it back
      if (e.code === 'P2002' || e.message?.includes('Unique constraint')) throw e;
      
      if (i === retries - 1) throw e;
      console.log(`   ⚠️  Retrying in ${delayMs/1000}s... (${e.message.slice(0, 80)})`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

/**
 * Extracts a specific collection from the mongodump archive.
 */
function extractCollection(buffer, targetCollection) {
  const docs = [];
  const seenIds = new Set();
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
      inTargetCollection = doc.collection === targetCollection;
      i += docSize; continue;
    }

    if (inTargetCollection && doc._id) {
      const docId = doc._id.toString();
      if (!seenIds.has(docId)) {
        seenIds.add(docId);
        docs.push(doc);
      }
    }
    i += docSize;
  }
  return docs;
}

// State to track migrated IDs for FK validation
const state = {
  floorIds: new Set(),
  userIds: new Set(),
  categoryNames: new Set(),
  stockIds: new Set(),
  menuItemIds: new Set(),
  tableIds: new Set(),
  orderIds: new Set(),
  roomIds: new Set(),
  fixedAssetIds: new Set()
};

async function loadExistingData() {
  console.log('🔗 Loading existing PostgreSQL data sequentially...');
  const floors = await withRetry(() => prisma.floor.findMany({ select: { id: true } }));
  const users = await withRetry(() => prisma.user.findMany({ select: { id: true } }));
  const categories = await withRetry(() => prisma.category.findMany({ select: { name: true, type: true } }));
  const stocks = await withRetry(() => prisma.stock.findMany({ select: { id: true } }));
  const menuItems = await withRetry(() => prisma.menuItem.findMany({ select: { id: true } }));
  const tables = await withRetry(() => prisma.table.findMany({ select: { id: true } }));
  const orders = await withRetry(() => prisma.order.findMany({ select: { id: true } }));
  const rooms = await withRetry(() => prisma.room.findMany({ select: { id: true } }));
  const assets = await withRetry(() => prisma.fixedAsset.findMany({ select: { id: true } }));
  
  floors.forEach(f => state.floorIds.add(f.id));
  users.forEach(u => state.userIds.add(u.id));
  categories.forEach(c => state.categoryNames.add(`${c.name}:${c.type}`));
  stocks.forEach(s => state.stockIds.add(s.id));
  menuItems.forEach(mi => state.menuItemIds.add(mi.id));
  tables.forEach(t => state.tableIds.add(t.id));
  orders.forEach(o => state.orderIds.add(o.id));
  rooms.forEach(r => state.roomIds.add(r.id));
  assets.forEach(a => state.fixedAssetIds.add(a.id));
  console.log('✅ Existing data loaded.\n');
}

async function migrateAll() {
  console.log('📖 Reading backup file...');
  const buffer = fs.readFileSync(BACKUP_FILE);
  console.log(`   Size: ${(buffer.length/1024/1024).toFixed(2)} MB\n`);

  await loadExistingData();

  // 1. Floors
  console.log('🏢 Migrating Floors...');
  const mongoFloors = extractCollection(buffer, 'floors');
  for (const f of mongoFloors) {
    const id = f._id.toString();
    if (state.floorIds.has(id)) continue;
    await withRetry(() => prisma.floor.create({
      data: {
        id,
        floorNumber: f.floorNumber,
        description: f.description || null,
        order: f.order || 0,
        isActive: f.isActive !== undefined ? f.isActive : true,
        isVIP: f.isVIP || false,
        type: safeEnum(f.type, VALID_FLOOR_TYPE, 'standard'),
        status: f.status || 'active',
        roomServiceCashierId: f.roomServiceCashierId?.toString() || null,
        roomServiceMenuTier: safeEnum(f.roomServiceMenuTier, VALID_MENU_TIER, 'standard'),
        createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
        updatedAt: f.updatedAt ? new Date(f.updatedAt) : new Date(),
      }
    }));
    state.floorIds.add(id);
  }
  console.log(`   Done floors.\n`);

  // 2. Users
  console.log('👤 Migrating Users...');
  const mongoUsers = extractCollection(buffer, 'users');
  for (const u of mongoUsers) {
    const id = u._id.toString();
    if (state.userIds.has(id)) continue;
    await withRetry(() => prisma.user.create({
      data: {
        id,
        name: u.name,
        email: u.email,
        password: u.password,
        plainPassword: u.plainPassword || null,
        role: safeEnum(u.role, VALID_USER_ROLE, 'cashier'),
        permissions: u.permissions || [],
        isActive: u.isActive !== undefined ? u.isActive : true,
        floorId: u.floorId && state.floorIds.has(u.floorId.toString()) ? u.floorId.toString() : null,
        assignedCategories: u.assignedCategories || [],
        canManageReception: u.canManageReception || false,
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
        lastLogoutAt: u.lastLogoutAt ? new Date(u.lastLogoutAt) : null,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      }
    }));
    state.userIds.add(id);
  }
  console.log(`   Done users.\n`);

  // 3. Categories
  console.log('📂 Migrating Categories...');
  const mongoCategories = extractCollection(buffer, 'categories');
  for (const c of mongoCategories) {
    const type = safeEnum(c.type, VALID_CATEGORY_TYPE, 'menu');
    if (state.categoryNames.has(`${c.name}:${type}`)) continue;
    await withRetry(() => prisma.category.create({
      data: {
        id: c._id.toString(),
        name: c.name,
        type,
        description: c.description || null,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      }
    }));
    state.categoryNames.add(`${c.name}:${type}`);
  }
  console.log(`   Done categories.\n`);

  // 4. Tables
  console.log('🛋️ Migrating Tables...');
  const mongoTables = extractCollection(buffer, 'tables');
  for (const t of mongoTables) {
    const id = t._id.toString();
    if (state.tableIds.has(id)) continue;
    await withRetry(() => prisma.table.create({
      data: {
        id,
        tableNumber: t.tableNumber,
        name: t.name || null,
        floorId: t.floorId && state.floorIds.has(t.floorId.toString()) ? t.floorId.toString() : null,
        isVIP: t.isVIP || false,
        status: safeEnum(t.status, VALID_TABLE_STATUS, 'active'),
        capacity: t.capacity || null,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
      }
    }));
    state.tableIds.add(id);
  }
  console.log(`   Done tables.\n`);

  // 5. Stocks
  console.log('📦 Migrating Stocks...');
  const mongoStocks = extractCollection(buffer, 'stocks');
  for (const s of mongoStocks) {
    const id = s._id.toString();
    if (state.stockIds.has(id)) continue;
    await withRetry(() => prisma.stock.create({
      data: {
        id,
        name: s.name,
        category: s.category,
        quantity: s.quantity || 0,
        storeQuantity: s.storeQuantity || 0,
        unit: s.unit || 'unit',
        unitType: safeEnum(s.unitType, VALID_STOCK_UNIT_TYPE, 'count'),
        minLimit: s.minLimit || 0,
        storeMinLimit: s.storeMinLimit || 0,
        averagePurchasePrice: s.averagePurchasePrice || 0,
        unitCost: s.unitCost || 0,
        trackQuantity: s.trackQuantity !== undefined ? s.trackQuantity : true,
        showStatus: s.showStatus !== undefined ? s.showStatus : true,
        status: safeEnum(s.status, VALID_STOCK_STATUS, 'active'),
        totalPurchased: s.totalPurchased || 0,
        totalConsumed: s.totalConsumed || 0,
        totalInvestment: s.totalInvestment || 0,
        sellUnitEquivalent: s.sellUnitEquivalent || 1,
        isVIP: s.isVIP || false,
        vipLevel: s.vipLevel || 1,
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
      }
    }));
    state.stockIds.add(id);

    // Stock Restock Entries
    if (s.restockHistory && Array.isArray(s.restockHistory)) {
      for (const r of s.restockHistory) {
        const rId = r._id?.toString() || `${id}-r-${Date.now()}`;
        const restockedById = r.restockedBy?.toString() || r.restockedById?.toString() || null;
        await withRetry(() => prisma.stockRestockEntry.create({
          data: {
            id: rId,
            stockId: id,
            date: r.date ? new Date(r.date) : new Date(),
            quantityAdded: r.quantityAdded || 0,
            totalPurchaseCost: r.totalPurchaseCost || 0,
            unitCostAtTime: r.unitCostAtTime || 0,
            notes: r.notes || null,
            restockedById: restockedById && state.userIds.has(restockedById) ? restockedById : null,
          }
        }).catch(() => {})); // Ignore duplicate entries inside same doc
      }
    }
  }
  console.log(`   Done stocks.\n`);

  // 6. MenuItems
  console.log('🍕 Migrating MenuItems...');
  const collections = ['menuitems', 'vip1menuitems', 'vip2menuitems', 'vipmenuitems'];
  for (const coll of collections) {
    const items = extractCollection(buffer, coll);
    const tier = coll === 'vip1menuitems' ? 'vip1' : (coll === 'vip2menuitems' ? 'vip2' : 'standard');
    for (const i of items) {
      const id = i._id.toString();
      if (state.menuItemIds.has(id)) continue;
      await withRetry(() => prisma.menuItem.create({
        data: {
          id,
          menuId: i.menuId || id,
          tier,
          name: i.name,
          mainCategory: safeEnum(i.mainCategory, VALID_MAIN_CATEGORY, 'Food'),
          category: i.category || null,
          price: i.price || 0,
          available: i.available !== undefined ? i.available : true,
          description: i.description || null,
          image: i.image || null,
          preparationTime: i.preparationTime || 10,
          reportUnit: i.reportUnit || null,
          reportQuantity: i.reportQuantity || null,
          distributions: i.distributions || [],
          stockItemId: i.stockItemId && state.stockIds.has(i.stockItemId.toString()) ? i.stockItemId.toString() : null,
          stockConsumption: i.stockConsumption || null,
          createdAt: i.createdAt ? new Date(i.createdAt) : new Date(),
          updatedAt: i.updatedAt ? new Date(i.updatedAt) : new Date(),
        }
      }));
      state.menuItemIds.add(id);

      // Recipe Ingredients
      if (i.recipe && Array.isArray(i.recipe)) {
        for (const ri of i.recipe) {
          const sId = ri.stockItemId?.toString() || ri.id?.toString();
          if (sId && state.stockIds.has(sId)) {
            await withRetry(() => prisma.recipeIngredient.create({
              data: {
                menuItemId: id,
                stockItemId: sId,
                stockItemName: ri.stockItemName || 'Component',
                quantityRequired: ri.quantityRequired || 0,
                unit: ri.unit || 'unit'
              }
            }).catch(() => {}));
          }
        }
      }
    }
  }
  console.log(`   Done menu items.\n`);

  // 7. Orders (Refined)
  console.log('📝 Migrating Orders...');
  const mongoOrders = extractCollection(buffer, 'orders');
  for (let idx = 0; idx < mongoOrders.length; idx++) {
    const o = mongoOrders[idx];
    const id = o._id.toString();
    if (state.orderIds.has(id)) continue;

    if ((idx + 1) % 500 === 0) console.log(`   Progress: ${idx+1}/${mongoOrders.length}...`);

    const createdById = o.createdBy?.toString() || o.createdById?.toString() || null;
    const floorId = o.floorId?.toString() || null;
    const tableId = o.tableId?.toString() || null;

    try {
      await withRetry(() => prisma.order.create({
        data: {
          id,
          orderNumber: o.orderNumber || `ORD-${id.slice(-6)}`,
          totalAmount: o.totalAmount || 0,
          status: safeEnum(o.status, VALID_ORDER_STATUS, 'pending'),
          paymentMethod: o.paymentMethod || 'cash',
          tableNumber: o.tableNumber || 'T?',
          tableId: tableId && state.tableIds.has(tableId) ? tableId : null,
          floorId: floorId && state.floorIds.has(floorId) ? floorId : null,
          floorNumber: o.floorNumber || null,
          createdById: createdById && state.userIds.has(createdById) ? createdById : null,
          isDeleted: o.isDeleted || false,
          createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
          updatedAt: o.updatedAt ? new Date(o.updatedAt) : new Date(),
        }
      }));
      state.orderIds.add(id);

      if (o.items && Array.isArray(o.items)) {
        for (const item of o.items) {
          await withRetry(() => prisma.orderItem.create({
            data: {
              orderId: id,
              name: item.name || 'Unknown',
              quantity: item.quantity || 1,
              price: item.price || 0,
              status: safeEnum(item.status, VALID_ORDER_STATUS, 'pending'),
              category: item.category || null,
              mainCategory: safeEnum(item.mainCategory, VALID_MAIN_CATEGORY, null),
              menuTier: safeEnum(item.menuTier, VALID_MENU_TIER, 'standard'),
            }
          }).catch(() => {}));
        }
      }
    } catch (err) {
      if (!err.message.includes('Unique constraint')) console.error(`   ❌ Error on order ${o.orderNumber}:`, err.message);
    }
  }
  console.log(`   Done orders.\n`);

  // 8. Rooms
  console.log('🛌 Migrating Rooms...');
  const mongoRooms = extractCollection(buffer, 'rooms');
  for (const r of mongoRooms) {
    const id = r._id.toString();
    if (state.roomIds.has(id)) continue;
    const fId = r.floorId?.toString() || null;
    if (!fId || !state.floorIds.has(fId)) continue;

    await withRetry(() => prisma.room.create({
      data: {
        id,
        roomNumber: r.roomNumber,
        name: r.name || null,
        floorId: fId,
        type: safeEnum(r.type, VALID_ROOM_TYPE, 'standard'),
        category: r.category || 'Standard',
        price: r.price || 0,
        status: safeEnum(r.status, VALID_ROOM_STATUS, 'available'),
        isActive: r.isActive !== undefined ? r.isActive : true,
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
      }
    }));
    state.roomIds.add(id);
  }
  console.log(`   Done rooms.\n`);

  // 9. Expenses
  console.log('💸 Migrating Expenses...');
  const mongoOpEx = extractCollection(buffer, 'operationalexpenses');
  for (const oe of mongoOpEx) {
    await withRetry(() => prisma.operationalExpense.create({
      data: {
        id: oe._id.toString(),
        date: oe.date ? new Date(oe.date) : new Date(),
        name: oe.name || 'Expense',
        category: oe.category || 'General',
        amount: oe.amount || 0,
        description: oe.description || null,
      }
    }).catch(() => {}));
  }
  const mongoDailyEx = extractCollection(buffer, 'dailyexpenses');
  for (const de of mongoDailyEx) {
    await withRetry(() => prisma.dailyExpense.create({
      data: {
        id: de._id.toString(),
        date: de.date ? new Date(de.date) : new Date(),
        otherExpenses: de.otherExpenses || 0,
        items: de.items || [],
        description: de.description || null,
      }
    }).catch(() => {}));
  }
  console.log(`   Done expenses.\n`);

  console.log('✅ FULL MIGRATION COMPLETE!');
  await prisma.$disconnect();
}

migrateAll().catch(err => {
  console.error('Fatal Migration Error:', err);
  prisma.$disconnect();
  process.exit(1);
});
