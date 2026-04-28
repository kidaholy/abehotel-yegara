
import { PrismaClient, UserRole, FloorType, MenuTier, MainCategory, TableStatus, OrderStatus, StockUnitType, StockStatus, CategoryType, SettingsType, FixedAssetStatus, TransferStatus, StoreLogType, RoomType, RoomStatus, ReceptionRequestStatus } from '@prisma/client';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/abehotel';

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    const db = mongoose.connection.db!;

    // Helper to get all documents from a collection
    const getAll = async (collectionName: string) => {
      return await db.collection(collectionName).find({}).toArray();
    };

    console.log('--- Starting Migration ---');

    // 1. Floors
    console.log('Migrating Floors...');
    const mongoFloors = await getAll('floors');
    for (const f of mongoFloors) {
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

    // 2. Users
    console.log('Migrating Users...');
    const mongoUsers = await getAll('users');
    for (const u of mongoUsers) {
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

    // 3. Tables
    console.log('Migrating Tables...');
    const mongoTables = await getAll('tables');
    for (const t of mongoTables) {
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

    // 4. Categories
    console.log('Migrating Categories...');
    const mongoCategories = await getAll('categories');
    for (const c of mongoCategories) {
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

    // 5. Stocks
    console.log('Migrating Stocks...');
    const mongoStocks = await getAll('stocks');
    // Pre-get all user IDs for validation
    const userIds = (await prisma.user.findMany({ select: { id: true } })).map(u => u.id);

    for (const s of mongoStocks) {
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

           await prisma.stockRestockEntry.create({
             data: {
               id: r._id ? r._id.toString() : undefined,
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
    console.log(`Migrated ${mongoStocks.length} stocks.`);

    // 6. Menu Items (Merging collections)
    console.log('Migrating Menu Items...');
    const tiers: { collection: string, tier: MenuTier }[] = [
      { collection: 'menuitems', tier: 'standard' },
      { collection: 'vip1menuitems', tier: 'vip1' },
      { collection: 'vip2menuitems', tier: 'vip2' },
      { collection: 'vipmenuitems', tier: 'standard' },
    ];

    const stockIds = (await prisma.stock.findMany({ select: { id: true } })).map(s => s.id);

    for (const t of tiers) {
      const items = await getAll(t.collection);
      for (const i of items) {
        const stockItemId = i.stockItemId ? i.stockItemId.toString() : null;
        const validStockItemId = stockItemId && stockIds.includes(stockItemId) ? stockItemId : null;

        await prisma.menuItem.upsert({
          where: { id: i._id.toString() },
          update: {},
          create: {
            id: i._id.toString(),
            menuId: i.menuId,
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
      console.log(`Migrated ${items.length} items from ${t.collection} as tier ${t.tier}.`);
    }

    // 7. Orders & OrderItems
    console.log('Migrating Orders...');
    const mongoOrders = await getAll('orders');
    const floorIds = (await prisma.floor.findMany({ select: { id: true } })).map(f => f.id);
    const tableIds = (await prisma.table.findMany({ select: { id: true } })).map(t => t.id);

    for (const o of mongoOrders) {
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
          items: {
            create: o.items ? o.items.map((i: any) => ({
              id: i._id ? i._id.toString() : undefined,
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
            })) : []
          }
        },
      });
    }
    console.log(`Migrated ${mongoOrders.length} orders.`);

    // 8. Store Logs
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

    // 9. Rooms
    console.log('Migrating Rooms...');
    const mongoRooms = await getAll('rooms');
    for (const r of mongoRooms) {
      await prisma.room.upsert({
        where: { id: r._id.toString() },
        update: {},
        create: {
          id: r._id.toString(),
          roomNumber: r.roomNumber,
          name: r.name,
          floorId: r.floorId.toString(),
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
    console.log(`Migrated ${mongoRooms.length} rooms.`);

    // 10. Fixed Assets
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

    // 11. Reception Requests
    console.log('Migrating Reception Requests...');
    const mongoReceptionRequests = await getAll('receptionrequests');
    for (const rr of mongoReceptionRequests) {
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
          inquiryType: rr.inquiryType,
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
          status: (rr.status as ReceptionRequestStatus) || 'CHECKIN_PENDING',
          submittedBy: rr.submittedBy ? rr.submittedBy.toString() : null,
          reviewedBy: rr.reviewedBy ? rr.reviewedBy.toString() : null,
          reviewNote: rr.reviewNote,
          createdAt: rr.createdAt ? new Date(rr.createdAt) : new Date(),
          updatedAt: rr.updatedAt ? new Date(rr.updatedAt) : new Date(),
        },
      });
    }
    console.log(`Migrated ${mongoReceptionRequests.length} reception requests.`);

    // 12. Settings
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

    // 13. Audit Logs (Optional, but good to have)
    console.log('Migrating Audit Logs...');
    const mongoAuditLogs = await getAll('audit_logs');
    for (const al of mongoAuditLogs) {
      await prisma.auditLog.create({
        data: {
          entityType: al.entityType || 'unknown',
          entityId: al.entityId ? al.entityId.toString() : 'unknown',
          action: al.action || 'unknown',
          field: al.field,
          oldValue: al.oldValue,
          newValue: al.newValue,
          performedBy: al.performedBy ? al.performedBy.toString() : 'system',
          timestamp: al.timestamp ? new Date(al.timestamp) : new Date(),
        }
      });
    }
    console.log(`Migrated ${mongoAuditLogs.length} audit logs.`);

    // 14. Operational Expenses
    console.log('Migrating Operational Expenses...');
    const mongoOpExpenses = await getAll('operationalexpenses');
    for (const oe of mongoOpExpenses) {
      await prisma.operationalExpense.upsert({
        where: { id: oe._id.toString() },
        update: {},
        create: {
          id: oe._id.toString(),
          date: oe.date ? new Date(oe.date) : new Date(),
          name: oe.name,
          category: oe.category || 'General',
          amount: oe.amount || 0,
          description: oe.description,
          createdAt: oe.createdAt ? new Date(oe.createdAt) : new Date(),
          updatedAt: oe.updatedAt ? new Date(oe.updatedAt) : new Date(),
        }
      });
    }
    console.log(`Migrated ${mongoOpExpenses.length} operational expenses.`);

    // 15. Daily Expenses
    console.log('Migrating Daily Expenses...');
    const mongoDailyExpenses = await getAll('dailyexpenses');
    for (const de of mongoDailyExpenses) {
      await prisma.dailyExpense.upsert({
        where: { id: de._id.toString() },
        update: {},
        create: {
          id: de._id.toString(),
          date: de.date ? new Date(de.date) : new Date(),
          otherExpenses: de.otherExpenses || 0,
          items: de.items || [],
          description: de.description,
          createdAt: de.createdAt ? new Date(de.createdAt) : new Date(),
          updatedAt: de.updatedAt ? new Date(de.updatedAt) : new Date(),
        }
      });
    }
    console.log(`Migrated ${mongoDailyExpenses.length} daily expenses.`);

    console.log('--- Migration Completed Successfully ---');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

migrate();
