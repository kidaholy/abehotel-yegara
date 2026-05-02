const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '..', 'abehotel.menuitems.json');
const targetPath = path.join(__dirname, '..', 'data', 'menuItems.json');

try {
    const rawData = fs.readFileSync(sourcePath, 'utf8');
    const items = JSON.parse(rawData);

    const migratedItems = items.map(item => {
        // Determine tier
        let tier = 'standard';
        const lowerName = (item.name || '').toLowerCase();
        const lowerCat = (item.category || '').toLowerCase();
        
        if (lowerName.includes('vip2') || lowerCat.includes('vip2')) {
            tier = 'vip2';
        } else if (lowerName.includes('vip1') || lowerCat.includes('vip1')) {
            tier = 'vip1';
        } else if (lowerName.includes('vip') || lowerCat.includes('vip')) {
            tier = 'vip1'; // Default generic VIP to vip1
        }

        return {
            id: item._id && item._id.$oid ? item._id.$oid : (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)),
            menuId: item.menuId || "",
            name: item.name || "Unnamed Item",
            description: item.description || "",
            mainCategory: item.mainCategory || "Food",
            category: item.category || "General",
            price: Number(item.price) || 0,
            image: item.image || "",
            preparationTime: Number(item.preparationTime) || 10,
            available: item.available !== false,
            stockItemId: item.stockItemId && item.stockItemId.$oid ? item.stockItemId.$oid : null,
            stockConsumption: Number(item.stockConsumption) || 0,
            isVIP: tier !== 'standard',
            tier: tier,
            createdAt: item.createdAt && item.createdAt.$date ? item.createdAt.$date : new Date().toISOString(),
            updatedAt: item.updatedAt && item.updatedAt.$date ? item.updatedAt.$date : new Date().toISOString()
        };
    });

    fs.writeFileSync(targetPath, JSON.stringify(migratedItems, null, 2));
    console.log(`Successfully migrated ${migratedItems.length} menu items to ${targetPath}`);

} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
}
