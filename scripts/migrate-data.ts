
import { PrismaClient, UserRole, FloorType, MenuTier, MainCategory, TableStatus, OrderStatus, StockUnitType, StockStatus, CategoryType, SettingsType, FixedAssetStatus, TransferStatus, StoreLogType, RoomType, RoomStatus, ReceptionRequestStatus } from '@prisma/client';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/abehotel';

const targetCollection = process.argv[2]; // e.g., 'settings' or 'users'

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    const db = mongoose.connection.db!;

    // Pre-get common IDs for validation
    const userIds = (await prisma.user.findMany({ select: { id: true } })).map(u => u.id);
    const stockIds = (await prisma.stock.findMany({ select: { id: true } })).map(s => s.id);

    // Helper to get all documents from a collection
    const getAll = async (collectionName: string) => {
      return await db.collection(collectionName).find({}).toArray();
    };

    const shouldMigrate = (name: string) => !targetCollection || targetCollection.toLowerCase() === name.toLowerCase();

    console.log('--- Starting Migration ---');

    // 1. Floors
    if (shouldMigrate('floors')) {
      console.log('Migrating Floors...');
      const mongoFloors = await getAll('floors');
      const existingIds = (await prisma.floor.findMany({ select: { id: true } })).map(f => f.id);
      for (const f of mongoFloors) {
        if (existingIds.includes(f._id.toString())) continue;
        await prisma.floor.upsert({
          where: { id: f._id.toString() },
          update: {},
          create: {
            id: f._id.toString(),
            floorNumber: f.floorNumber,
            description: f.description,
            order: f.order || 0,
            isActive: f.isActive !== undefined ? f.isActive : true,
            isVIP: f.isVIP || false,
            type: (f.type as FloorType) || 'standard',
            status: f.status || 'active',
            roomServiceCashierId: f.roomServiceCashierId ? f.roomServiceCashierId.toString() : null,
            roomServiceMenuTier: (f.roomServiceMenuTier as MenuTier) || 'standard',
            createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
            updatedAt: f.updatedAt ? new Date(f.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${mongoFloors.length} floors.`);
    }

    // 2. Users
    if (shouldMigrate('users')) {
      console.log('Migrating Users...');
      const mongoUsers = await getAll('users');
      const existingIds = (await prisma.user.findMany({ select: { id: true } })).map(u => u.id);
      for (const u of mongoUsers) {
        if (existingIds.includes(u._id.toString())) continue;
        await prisma.user.upsert({
          where: { id: u._id.toString() },
          update: {},
          create: {
            id: u._id.toString(),
            name: u.name,
            email: u.email,
            password: u.password,
            plainPassword: u.plainPassword,
            role: (u.role as UserRole) || 'cashier',
            permissions: u.permissions || [],
            isActive: u.isActive !== undefined ? u.isActive : true,
            floorId: u.floorId ? u.floorId.toString() : null,
            assignedCategories: u.assignedCategories || [],
            canManageReception: u.canManageReception || false,
            lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
            lastLogoutAt: u.lastLogoutAt ? new Date(u.lastLogoutAt) : null,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${mongoUsers.length} users.`);
    }

    // 3. Tables
    if (shouldMigrate('tables')) {
      console.log('Migrating Tables...');
      const mongoTables = await getAll('tables');
      const existingIds = (await prisma.table.findMany({ select: { id: true } })).map(t => t.id);
      for (const t of mongoTables) {
        if (existingIds.includes(t._id.toString())) continue;
        await prisma.table.upsert({
          where: { id: t._id.toString() },
          update: {},
          create: {
            id: t._id.toString(),
            tableNumber: t.tableNumber,
            name: t.name,
            floorId: t.floorId ? t.floorId.toString() : null,
            isVIP: t.isVIP || false,
            status: (t.status as TableStatus) || 'active',
            capacity: t.capacity,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${mongoTables.length} tables.`);
    }

    // 4. Categories
    if (shouldMigrate('categories')) {
      console.log('Migrating Categories...');
      const mongoCategories = await getAll('categories');
      const existingIds = (await prisma.category.findMany({ select: { id: true } })).map(c => c.id);
      for (const c of mongoCategories) {
        if (existingIds.includes(c._id.toString())) continue;
        // Map category type to enum
        let catType: CategoryType = 'menu';
        const rawType = (c.type || 'menu').toLowerCase();
        if (rawType === 'vip1_menu' || rawType === 'vip1menu') catType = 'vip1_menu';
        else if (rawType === 'vip2_menu' || rawType === 'vip2menu') catType = 'vip2_menu';
        else if (rawType === 'fixed_asset' || rawType === 'fixedasset') catType = 'fixed_asset';
        else if (['menu', 'stock', 'expense', 'room', 'service', 'distribution'].includes(rawType)) {
          catType = rawType as CategoryType;
        }

        await prisma.category.upsert({
          where: { 
            name_type: {
              name: c.name,
              type: catType
            }
          },
          update: {},
          create: {
            id: c._id.toString(),
            name: c.name,
            type: catType,
            description: c.description,
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${mongoCategories.length} categories.`);
    }

    // 5. Stocks
    if (shouldMigrate('stocks')) {
      console.log('Migrating Stocks...');
      const mongoStocks = await getAll('stocks');
      const existingIds = (await prisma.stock.findMany({ select: { id: true } })).map(s => s.id);

      for (const s of mongoStocks) {
        if (existingIds.includes(s._id.toString())) continue;
        await prisma.stock.upsert({
          where: { id: s._id.toString() },
          update: {},
          create: {
            id: s._id.toString(),
            name: s.name,
            category: s.category,
            quantity: s.quantity || 0,
            storeQuantity: s.storeQuantity || 0,
            unit: s.unit,
            unitType: (s.unitType as StockUnitType) || 'count',
            minLimit: s.minLimit || 0,
            storeMinLimit: s.storeMinLimit || 0,
            averagePurchasePrice: s.averagePurchasePrice || 0,
            unitCost: s.unitCost || 0,
            trackQuantity: s.trackQuantity !== undefined ? s.trackQuantity : true,
            showStatus: s.showStatus !== undefined ? s.showStatus : true,
            status: (s.status as StockStatus) || 'active',
            totalPurchased: s.totalPurchased || 0,
            totalConsumed: s.totalConsumed || 0,
            totalInvestment: s.totalInvestment || 0,
            sellUnitEquivalent: s.sellUnitEquivalent || 1,
            isVIP: s.isVIP || false,
            vipLevel: s.vipLevel || 1,
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
            updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
          },
        });
        
        // Stock Restock History
        if (s.restockHistory && Array.isArray(s.restockHistory)) {
          for (const r of s.restockHistory) {
             const restockedById = r.restockedBy ? r.restockedBy.toString() : null;
             const validRestockedById = restockedById && userIds.includes(restockedById) ? restockedById : null;

             const rId = r._id ? r._id.toString() : undefined;
             if (rId) {
               await prisma.stockRestockEntry.upsert({
                 where: { id: rId },
                 update: {},
                 create: {
                   id: rId,
                   stockId: s._id.toString(),
                   date: r.date ? new Date(r.date) : new Date(),
                   quantityAdded: r.quantityAdded || 0,
                   totalPurchaseCost: r.totalPurchaseCost || 0,
                   unitCostAtTime: r.unitCostAtTime || 0,
                   notes: r.notes,
                   restockedById: validRestockedById,
                 }
               });
             } else {
               await prisma.stockRestockEntry.create({
                 data: {
                   stockId: s._id.toString(),
                   date: r.date ? new Date(r.date) : new Date(),
                   quantityAdded: r.quantityAdded || 0,
                   totalPurchaseCost: r.totalPurchaseCost || 0,
                   unitCostAtTime: r.unitCostAtTime || 0,
                   notes: r.notes,
                   restockedById: validRestockedById,
                 }
               });
             }
          }
        }
      }
      console.log(`Migrated ${mongoStocks.length} stocks.`);
    }

    if (shouldMigrate('menuitems') || shouldMigrate('vip1menuitems') || shouldMigrate('vip2menuitems') || shouldMigrate('vipmenuitems')) {
      console.log('Migrating Menu Items...');
      const tiers: { collection: string, tier: MenuTier }[] = [
        { collection: 'menuitems', tier: 'standard' },
        { collection: 'vip1menuitems', tier: 'vip1' },
        { collection: 'vip2menuitems', tier: 'vip2' },
        { collection: 'vipmenuitems', tier: 'standard' },
      ];
      const existingIds = (await prisma.menuItem.findMany({ select: { id: true } })).map(i => i.id);

      for (const t of tiers) {
        if (!shouldMigrate(t.collection)) continue;
        const items = await getAll(t.collection);
        let count = 0;
        for (const i of items) {
          count++;
          if (count % 10 === 0) console.log(`  Processing ${t.collection}: ${count}/${items.length}...`);
          
          if (existingIds.includes(i._id.toString())) {
            continue;
          }

          const stockItemId = i.stockItemId ? i.stockItemId.toString() : null;
          const validStockItemId = stockItemId && stockIds.includes(stockItemId) ? stockItemId : null;

          await prisma.menuItem.upsert({
            where: { id: i._id.toString() },
            update: {},
            create: {
              id: i._id.toString(),
              menuId: i.menuId || i._id.toString(),
              tier: t.tier,
              name: i.name,
              mainCategory: (i.mainCategory as MainCategory) || 'Food',
              category: i.category,
              price: i.price || 0,
              available: i.available !== undefined ? i.available : true,
              description: i.description,
              image: i.image,
              preparationTime: i.preparationTime || 10,
              reportUnit: i.reportUnit,
              reportQuantity: i.reportQuantity,
              distributions: i.distributions || [],
              stockItemId: validStockItemId,
              stockConsumption: i.stockConsumption,
              createdAt: i.createdAt ? new Date(i.createdAt) : new Date(),
              updatedAt: i.updatedAt ? new Date(i.updatedAt) : new Date(),
            },
          });

          // Recipe Ingredients
          if (i.recipe && Array.isArray(i.recipe)) {
            for (const ri of i.recipe) {
               const rStockId = ri.stockItemId.toString();
               if (stockIds.includes(rStockId)) {
                 const riId = ri._id ? ri._id.toString() : undefined;
                 if (riId) {
                   await prisma.recipeIngredient.upsert({
                     where: { id: riId },
                     update: {},
                     create: {
                       id: riId,
                       menuItemId: i._id.toString(),
                       stockItemId: rStockId,
                       stockItemName: ri.stockItemName,
                       quantityRequired: ri.quantityRequired,
                       unit: ri.unit,
                     }
                   });
                 } else {
                   await prisma.recipeIngredient.create({
                     data: {
                       menuItemId: i._id.toString(),
                       stockItemId: rStockId,
                       stockItemName: ri.stockItemName,
                       quantityRequired: ri.quantityRequired,
                       unit: ri.unit,
                     }
                   });
                 }
               }
            }
          }
        }
        console.log(`Migrated ${items.length} items from ${t.collection} as tier ${t.tier}.`);
      }
    }

    // 7. Orders & OrderItems
    if (shouldMigrate('orders')) {
      console.log('Migrating Orders...');
      const existingOrderIds = (await prisma.order.findMany({ select: { id: true } })).map(o => o.id);
      const mongoOrders = await getAll('orders');
      const floorIds = (await prisma.floor.findMany({ select: { id: true } })).map(f => f.id);
      const tableIds = (await prisma.table.findMany({ select: { id: true } })).map(t => t.id);

      let orderCount = 0;
      for (const o of mongoOrders) {
        orderCount++;
        if (orderCount % 10 === 0) console.log(`  Processing Orders: ${orderCount}/${mongoOrders.length}...`);

        if (existingOrderIds.includes(o._id.toString())) {
          continue;
        }

        const createdById = o.createdBy ? o.createdBy.toString() : (o.createdById ? o.createdById.toString() : null);
        const validCreatedById = createdById && userIds.includes(createdById) ? createdById : null;
        
        const orderFloorId = o.floorId ? o.floorId.toString() : null;
        const validFloorId = orderFloorId && floorIds.includes(orderFloorId) ? orderFloorId : null;

        const orderTableId = o.tableId ? o.tableId.toString() : null;
        const validTableId = orderTableId && tableIds.includes(orderTableId) ? orderTableId : null;

        await prisma.order.upsert({
          where: { id: o._id.toString() },
          update: {},
          create: {
            id: o._id.toString(),
            orderNumber: o.orderNumber,
            totalAmount: o.totalAmount || 0,
            tax: o.tax || 0,
            subtotal: o.subtotal || 0,
            status: (o.status as OrderStatus) || 'pending',
            paymentMethod: o.paymentMethod || 'cash',
            customerName: o.customerName,
            tableNumber: o.tableNumber,
            batchNumber: o.batchNumber,
            tableId: validTableId,
            floorId: validFloorId,
            floorNumber: o.floorNumber,
            distributions: o.distributions || [],
            createdById: validCreatedById,
            kitchenAcceptedAt: o.kitchenAcceptedAt ? new Date(o.kitchenAcceptedAt) : null,
            readyAt: o.readyAt ? new Date(o.readyAt) : null,
            servedAt: o.servedAt ? new Date(o.servedAt) : null,
            delayMinutes: o.delayMinutes,
            thresholdMinutes: o.thresholdMinutes,
            totalPreparationTime: o.totalPreparationTime,
            isDeleted: o.isDeleted || false,
            createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
            updatedAt: o.updatedAt ? new Date(o.updatedAt) : new Date(),
          },
        });

        // Handle Order Items separately for idempotency
        if (o.items && Array.isArray(o.items)) {
          for (const i of o.items) {
            const iId = i._id ? i._id.toString() : undefined;
            if (iId) {
              await prisma.orderItem.upsert({
                where: { id: iId },
                update: {},
                create: {
                  id: iId,
                  orderId: o._id.toString(),
                  menuItemId: i.menuItemId ? i.menuItemId.toString() : null,
                  menuId: i.menuId,
                  name: i.name,
                  quantity: i.quantity || 1,
                  price: i.price || 0,
                  status: (i.status as OrderStatus) || 'pending',
                  modifiers: i.modifiers || [],
                  notes: i.notes,
                  category: i.category,
                  mainCategory: (i.mainCategory as MainCategory) || null,
                  menuTier: (i.menuTier as MenuTier) || 'standard',
                  initialStatus: i.initialStatus,
                  preparationTime: i.preparationTime,
                }
              });
            } else {
               await prisma.orderItem.create({
                 data: {
                  orderId: o._id.toString(),
                  menuItemId: i.menuItemId ? i.menuItemId.toString() : null,
                  menuId: i.menuId,
                  name: i.name,
                  quantity: i.quantity || 1,
                  price: i.price || 0,
                  status: (i.status as OrderStatus) || 'pending',
                  modifiers: i.modifiers || [],
                  notes: i.notes,
                  category: i.category,
                  mainCategory: (i.mainCategory as MainCategory) || null,
                  menuTier: (i.menuTier as MenuTier) || 'standard',
                  initialStatus: i.initialStatus,
                  preparationTime: i.preparationTime,
                 }
               });
            }
          }
        }
      }
      console.log(`Migrated ${mongoOrders.length} orders.`);
    }

    // 8. Store Logs
    if (shouldMigrate('storelogs')) {
      console.log('Migrating Store Logs...');
      const mongoStoreLogs = await getAll('storelogs');
      for (const sl of mongoStoreLogs) {
        const stockId = sl.stockId.toString();
        const validStockId = stockIds.includes(stockId) ? stockId : null;
        
        const logUserId = sl.user ? sl.user.toString() : (sl.userId ? sl.userId.toString() : null);
        const validUserId = logUserId && userIds.includes(logUserId) ? logUserId : null;

        if (validStockId && validUserId) {
          await prisma.storeLog.upsert({
            where: { id: sl._id.toString() },
            update: {},
            create: {
              id: sl._id.toString(),
              stockId: validStockId,
              type: (sl.type as StoreLogType) || 'PURCHASE',
              quantity: sl.quantity || 0,
              unit: sl.unit,
              pricePerUnit: sl.pricePerUnit,
              totalPrice: sl.totalPrice,
              userId: validUserId,
              notes: sl.notes,
              date: sl.date ? new Date(sl.date) : new Date(),
              createdAt: sl.createdAt ? new Date(sl.createdAt) : new Date(),
              updatedAt: sl.updatedAt ? new Date(sl.updatedAt) : new Date(),
            },
          });
        }
      }
      console.log(`Migrated ${mongoStoreLogs.length} store logs.`);
    }

    // 9. Rooms
    if (shouldMigrate('rooms')) {
      console.log('Migrating Rooms...');
      const mongoRooms = await getAll('rooms');
      const floorIds = (await prisma.floor.findMany({ select: { id: true } })).map(f => f.id);
      for (const r of mongoRooms) {
        const rFloorId = r.floorId ? r.floorId.toString() : null;
        const validFloorId = rFloorId && floorIds.includes(rFloorId) ? rFloorId : null;
        
        if (validFloorId) {
          await prisma.room.upsert({
            where: { roomNumber: r.roomNumber },
            update: {},
            create: {
              id: r._id.toString(),
              roomNumber: r.roomNumber,
              name: r.name,
              floorId: validFloorId,
              type: (r.type as RoomType) || 'standard',
              category: r.category || 'Standard',
              price: r.price || 0,
              status: (r.status as RoomStatus) || 'available',
              isActive: r.isActive !== undefined ? r.isActive : true,
              description: r.description,
              roomServiceMenuTier: (r.roomServiceMenuTier as MenuTier) || 'standard',
              createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
              updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
            },
          });
        }
      }
      console.log(`Migrated ${mongoRooms.length} rooms.`);
    }

    // 10. Fixed Assets
    if (shouldMigrate('fixedassets')) {
      console.log('Migrating Fixed Assets...');
      const mongoFixedAssets = await getAll('fixedassets');
      for (const fa of mongoFixedAssets) {
        await prisma.fixedAsset.upsert({
          where: { id: fa._id.toString() },
          update: {},
          create: {
            id: fa._id.toString(),
            name: fa.name,
            category: fa.category || 'General',
            quantity: fa.quantity || 1,
            unitPrice: fa.unitPrice || 0,
            totalValue: fa.totalValue || 0,
            totalInvested: fa.totalInvested || 0,
            purchaseDate: fa.purchaseDate ? new Date(fa.purchaseDate) : new Date(),
            status: (fa.status as FixedAssetStatus) || 'active',
            notes: fa.notes,
            createdAt: fa.createdAt ? new Date(fa.createdAt) : new Date(),
            updatedAt: fa.updatedAt ? new Date(fa.updatedAt) : new Date(),
          },
        });
        
        if (fa.dismissals && Array.isArray(fa.dismissals)) {
          for (const d of fa.dismissals) {
            await prisma.fixedAssetDismissal.create({
              data: {
                fixedAssetId: fa._id.toString(),
                date: d.date ? new Date(d.date) : new Date(),
                quantity: d.quantity || 0,
                reason: d.reason || 'None',
                valueLost: d.valueLost || 0,
                dismissedById: d.dismissedBy ? d.dismissedBy.toString() : null,
              }
            });
          }
        }
      }
      console.log(`Migrated ${mongoFixedAssets.length} fixed assets.`);
    }

    // 11. Reception Requests (Guest Check-ins)
    if (shouldMigrate('receptionrequests')) {
      console.log('Migrating Reception Requests...');
      const mongoReceptionRequests = await getAll('receptionrequests');
      const existingIds = (await prisma.receptionRequest.findMany({ select: { id: true } })).map(rr => rr.id);
      for (const rr of mongoReceptionRequests) {
        if (existingIds.includes(rr._id.toString())) continue;

        // Map status to enum
        let status: ReceptionRequestStatus = 'CHECKIN_PENDING';
        const rawStatus = (rr.status || 'CHECKIN_PENDING').toUpperCase();
        if (rawStatus === 'CHECKIN_APPROVED') status = 'CHECKIN_APPROVED';
        else if (rawStatus === 'ACTIVE') status = 'ACTIVE';
        else if (rawStatus === 'CHECKOUT_PENDING') status = 'CHECKOUT_PENDING';
        else if (rawStatus === 'CHECKOUT_APPROVED') status = 'CHECKOUT_APPROVED';
        else if (rawStatus === 'CHECKED_OUT') status = 'CHECKED_OUT';
        else if (rawStatus === 'PENDING') status = 'CHECKIN_PENDING';
        else if (rawStatus === 'APPROVED') status = 'CHECKIN_APPROVED';

        await prisma.receptionRequest.upsert({
          where: { id: rr._id.toString() },
          update: {},
          create: {
            id: rr._id.toString(),
            guestName: rr.guestName,
            faydaId: rr.faydaId,
            phone: rr.phone,
            idPhotoFront: rr.idPhotoFront,
            idPhotoBack: rr.idPhotoBack,
            photoUrl: rr.photoUrl,
            floorId: rr.floorId ? rr.floorId.toString() : null,
            roomNumber: rr.roomNumber,
            roomPrice: rr.roomPrice,
            inquiryType: rr.inquiryType || 'standard',
            checkIn: rr.checkIn,
            checkOut: rr.checkOut,
            checkInTime: rr.checkInTime,
            checkOutTime: rr.checkOutTime,
            guests: rr.guests,
            paymentMethod: rr.paymentMethod,
            chequeNumber: rr.chequeNumber,
            paymentReference: rr.paymentReference,
            transactionUrl: rr.transactionUrl,
            notes: rr.notes,
            status: status,
            submittedBy: rr.submittedBy ? rr.submittedBy.toString() : null,
            reviewedBy: rr.reviewedBy ? rr.reviewedBy.toString() : null,
            reviewNote: rr.reviewNote,
            createdAt: rr.createdAt ? new Date(rr.createdAt) : new Date(),
            updatedAt: rr.updatedAt ? new Date(rr.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${mongoReceptionRequests.length} reception requests.`);
    }

    // 12. Settings
    if (shouldMigrate('settings')) {
      console.log('Migrating Settings...');
      const mongoSettings = await getAll('settings');
      for (const s of mongoSettings) {
        await prisma.settings.upsert({
          where: { key: s.key },
          update: {},
          create: {
            id: s._id.toString(),
            key: s.key,
            value: s.value || '',
            type: (s.type as SettingsType) || 'string',
            description: s.description,
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
            updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${mongoSettings.length} settings.`);
    }

    // 13. Audit Logs
    if (shouldMigrate('auditlogs')) {
      console.log('Migrating Audit Logs...');
      const mongoAuditLogs = await getAll('auditlogs');
      for (const al of mongoAuditLogs) {
        await prisma.auditLog.upsert({
          where: { id: al._id.toString() },
          update: {},
          create: {
            id: al._id.toString(),
            entityType: al.entityType || 'unknown',
            entityId: al.entityId ? al.entityId.toString() : 'unknown',
            action: al.action || al.details || 'unknown',
            field: al.field,
            oldValue: al.oldValue,
            newValue: al.newValue,
            performedBy: al.performedBy ? al.performedBy.toString() : (al.userId ? al.userId.toString() : 'system'),
            timestamp: al.timestamp ? new Date(al.timestamp) : (al.createdAt ? new Date(al.createdAt) : new Date()),
          },
        });
      }
      console.log(`Migrated ${mongoAuditLogs.length} audit logs.`);
    }

    // 14. Operational Expenses
    if (shouldMigrate('operationalexpenses')) {
      console.log('Migrating Operational Expenses...');
      const mongoOpEx = await getAll('operationalexpenses');
      for (const oe of mongoOpEx) {
        await prisma.operationalExpense.upsert({
          where: { id: oe._id.toString() },
          update: {},
          create: {
            id: oe._id.toString(),
            name: oe.name || oe.title || 'Expense',
            amount: oe.amount || 0,
            category: oe.category || 'General',
            date: oe.date ? new Date(oe.date) : new Date(),
            description: oe.description || oe.notes,
            createdAt: oe.createdAt ? new Date(oe.createdAt) : new Date(),
            updatedAt: oe.updatedAt ? new Date(oe.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${mongoOpEx.length} operational expenses.`);
    }

    // 15. Daily Expenses
    if (shouldMigrate('dailyexpenses')) {
      console.log('Migrating Daily Expenses...');
      const mongoDailyEx = await getAll('dailyexpenses');
      for (const de of mongoDailyEx) {
        await prisma.dailyExpense.upsert({
          where: { date: de.date ? new Date(de.date) : new Date() },
          update: {},
          create: {
            id: de._id.toString(),
            date: de.date ? new Date(de.date) : new Date(),
            otherExpenses: (de.otherExpenses || de.amount || 0),
            items: de.items || [],
            description: de.description || de.notes || de.title,
            createdAt: de.createdAt ? new Date(de.createdAt) : new Date(),
            updatedAt: de.updatedAt ? new Date(de.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${mongoDailyEx.length} daily expenses.`);
    }

    console.log('--- Migration Completed Successfully ---');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

migrate();
