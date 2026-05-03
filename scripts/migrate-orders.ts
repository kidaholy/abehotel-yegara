import fs from 'fs';
import path from 'path';

// Define the root and data directories
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SOURCE_FILE = path.join(ROOT_DIR, 'abehotel.orders.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const ORDER_ITEMS_FILE = path.join(DATA_DIR, 'orderItems.json');

interface MongoId {
    $oid: string;
}

interface MongoDate {
    $date: string;
}

interface MongoOrderItem {
    menuItemId: string;
    menuId: string;
    name: string;
    quantity: number;
    price: number;
    status: string;
    modifiers: any[];
    notes: string;
    category: string;
    mainCategory: string;
    menuTier: string;
    preparationTime: number;
    _id: MongoId;
}

interface MongoOrder {
    _id: MongoId;
    orderNumber: string;
    items: MongoOrderItem[];
    totalAmount: number;
    tax: number;
    subtotal: number;
    status: string;
    paymentMethod: string;
    customerName: string;
    tableNumber: string;
    floorId: MongoId;
    floorNumber: string;
    distributions: any[];
    createdBy: MongoId;
    thresholdMinutes: number;
    isDeleted: boolean;
    createdAt: MongoDate;
    updatedAt: MongoDate;
    __v?: number;
    delayMinutes?: number;
    servedAt?: MongoDate;
    totalPreparationTime?: number;
}

function transformMongoOrder(mongoOrder: MongoOrder) {
    const orderId = mongoOrder._id.$oid;
    const createdAt = mongoOrder.createdAt.$date;
    const updatedAt = mongoOrder.updatedAt.$date;

    const transformedItems = mongoOrder.items.map(item => {
        const itemId = item._id.$oid;
        return {
            id: itemId,
            createdAt: createdAt,
            updatedAt: updatedAt,
            menuItemId: item.menuItemId,
            menuId: item.menuId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            status: item.status,
            modifiers: item.modifiers || [],
            notes: item.notes || "",
            category: item.category,
            mainCategory: item.mainCategory,
            menuTier: item.menuTier,
            preparationTime: item.preparationTime,
            orderId: orderId,
            isDeleted: false
        };
    });

    const transformedOrder = {
        id: orderId,
        createdAt: createdAt,
        updatedAt: updatedAt,
        isDeleted: mongoOrder.isDeleted || false,
        orderNumber: mongoOrder.orderNumber,
        totalAmount: mongoOrder.totalAmount,
        subtotal: mongoOrder.subtotal,
        tax: mongoOrder.tax,
        status: mongoOrder.status,
        paymentMethod: mongoOrder.paymentMethod,
        customerName: mongoOrder.customerName,
        tableNumber: mongoOrder.tableNumber,
        floorId: mongoOrder.floorId?.$oid,
        floorNumber: mongoOrder.floorNumber,
        createdById: mongoOrder.createdBy?.$oid,
        thresholdMinutes: mongoOrder.thresholdMinutes,
        items: transformedItems,
        servedAt: mongoOrder.servedAt?.$date,
        delayMinutes: mongoOrder.delayMinutes || 0,
        totalPreparationTime: mongoOrder.totalPreparationTime || 0
    };

    return { transformedOrder, transformedItems };
}

function migrate() {
    const fullReplace = process.argv.includes('--full');
    console.log(`Starting migration${fullReplace ? ' (full replace from source)' : ''}...`);

    if (!fs.existsSync(SOURCE_FILE)) {
        console.error(`Source file not found: ${SOURCE_FILE}`);
        return;
    }

    const sourceData: MongoOrder[] = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf-8'));
    console.log(`Found ${sourceData.length} orders in source.`);

    if (fullReplace) {
        const newOrders: any[] = [];
        const newItems: any[] = [];
        for (const mongoOrder of sourceData) {
            const { transformedOrder, transformedItems } = transformMongoOrder(mongoOrder);
            newOrders.push(transformedOrder);
            newItems.push(...transformedItems);
        }
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(newOrders, null, 2));
        fs.writeFileSync(ORDER_ITEMS_FILE, JSON.stringify(newItems, null, 2));
        console.log('Migration complete!');
        console.log(`Wrote ${newOrders.length} orders and ${newItems.length} order items.`);
        return;
    }

    // Load existing data to avoid duplicates
    let existingOrders = [];
    if (fs.existsSync(ORDERS_FILE)) {
        existingOrders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8'));
    }
    const existingOrderIds = new Set(existingOrders.map((o: any) => o.id));

    let existingItems = [];
    if (fs.existsSync(ORDER_ITEMS_FILE)) {
        existingItems = JSON.parse(fs.readFileSync(ORDER_ITEMS_FILE, 'utf-8'));
    }
    const existingItemIds = new Set(existingItems.map((i: any) => i.id));

    const newOrders = [...existingOrders];
    const newItems = [...existingItems];

    let migratedOrdersCount = 0;
    let migratedItemsCount = 0;

    for (const mongoOrder of sourceData) {
        const orderId = mongoOrder._id.$oid;

        if (existingOrderIds.has(orderId)) {
            continue;
        }

        const { transformedOrder, transformedItems } = transformMongoOrder(mongoOrder);

        for (const transformedItem of transformedItems) {
            if (!existingItemIds.has(transformedItem.id)) {
                newItems.push(transformedItem);
                migratedItemsCount++;
            }
        }

        newOrders.push(transformedOrder);
        migratedOrdersCount++;
    }

    fs.writeFileSync(ORDERS_FILE, JSON.stringify(newOrders, null, 2));
    fs.writeFileSync(ORDER_ITEMS_FILE, JSON.stringify(newItems, null, 2));

    console.log(`Migration complete!`);
    console.log(`Added ${migratedOrdersCount} new orders.`);
    console.log(`Added ${migratedItemsCount} new order items.`);
}

migrate();
