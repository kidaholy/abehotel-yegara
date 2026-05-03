import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
} catch (err) {
    console.error('[json-db] Could not ensure data directory:', DATA_DIR, err);
}

export class JsonDB {
    private filePath: string;

    constructor(public table: string) {
        this.filePath = path.join(DATA_DIR, `${table}.json`);
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
        }
    }

    private read(): any[] {
        try {
            if (!fs.existsSync(this.filePath)) return [];
            const content = fs.readFileSync(this.filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            return [];
        }
    }

    private write(data: any[]) {
        const tmpPath = `${this.filePath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
        fs.renameSync(tmpPath, this.filePath);
    }

    async findMany(args?: any): Promise<any[]> {
        let data = this.read();

        // 1. Include (Joins) - CRITICAL: Must happen before filtering if filters depend on relations
        if (args?.include) {
            for (const item of data) {
                await this.applyIncludes(item, args.include);
            }
        }

        // 2. Where Filtering
        if (args?.where) {
            data = data.filter(item => this.matchCriteria(item, args.where));
        }

        // 3. OrderBy
        if (args?.orderBy) {
            const orderByArr = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
            for (const order of orderByArr) {
                const [key, direction] = Object.entries(order)[0] as [string, 'asc' | 'desc'];
                data.sort((a, b) => {
                    if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
                    if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
                    return 0;
                });
            }
        }

        // 4. Take (Limit)
        if (args?.take !== undefined) {
            data = data.slice(0, args.take);
        }

        return data;
    }

    async findUnique(args: any): Promise<any | null> {
        const data = await this.findMany({ where: args.where, include: args.include });
        return data[0] || null;
    }

    async findFirst(args?: any): Promise<any | null> {
        const data = await this.findMany({ ...args, take: 1 });
        return data[0] || null;
    }

    async count(args?: any): Promise<number> {
        const data = await this.findMany({ where: args?.where });
        return data.length;
    }

    async create(args: { data: any, include?: any }): Promise<any> {
        const data = this.read();
        const { items, ...rest } = args.data;
        
        const newItem = {
            id: rest.id || this.generateCuid(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDeleted: rest.isDeleted !== undefined ? rest.isDeleted : false,
            ...rest
        };

        // Handle nested creations (e.g., items: { create: [...] })
        if (args.data.items?.create) {
            const itemsToCreate = args.data.items.create;
            const itemsTable = new JsonDB('orderItems');
            const createdItems = [];
            for (const itemData of itemsToCreate) {
                const item = await itemsTable.create({ data: { ...itemData, orderId: newItem.id } });
                createdItems.push(item);
            }
            newItem.items = createdItems;
        }

        data.push(newItem);
        this.write(data);
        return newItem;
    }

    async update(args: { where: any, data: any }): Promise<any> {
        const data = this.read();
        const index = data.findIndex(item => this.matchCriteria(item, args.where));
        if (index === -1) throw new Error(`${this.table} not found`);
        
        data[index] = {
            ...data[index],
            ...args.data,
            updatedAt: new Date().toISOString()
        };
        this.write(data);
        return data[index];
    }

    async delete(args: { where: any }): Promise<any> {
        const data = this.read();
        const index = data.findIndex(item => this.matchCriteria(item, args.where));
        if (index === -1) throw new Error(`${this.table} not found`);
        
        const deletedItem = data.splice(index, 1)[0];
        this.write(data);
        return deletedItem;
    }

    async upsert(args: { where: any, create: any, update: any }): Promise<any> {
        try {
            return await this.update({ where: args.where, data: args.update });
        } catch (e) {
            return await this.create({ data: args.create });
        }
    }

    async updateMany(args: { where: any, data: any }): Promise<{ count: number }> {
        const data = this.read();
        let count = 0;
        const updatedData = data.map(item => {
            const match = this.matchCriteria(item, args.where);
            if (match) {
                count++;
                return { ...item, ...args.data, updatedAt: new Date().toISOString() };
            }
            return item;
        });
        this.write(updatedData);
        return { count };
    }

    async deleteMany(args?: { where?: any }): Promise<{ count: number }> {
        const data = this.read();
        const initialLength = data.length;
        if (!args?.where) {
            this.write([]);
            return { count: initialLength };
        }
        const remainingData = data.filter(item => !this.matchCriteria(item, args.where));
        this.write(remainingData);
        return { count: initialLength - remainingData.length };
    }

    async aggregate(args: { where?: any, _sum?: any, _count?: any, _avg?: any }): Promise<any> {
        const data = await this.findMany({ where: args.where });
        const result: any = { _sum: {}, _count: {}, _avg: {} };

        if (args._sum) {
            for (const key of Object.keys(args._sum)) {
                result._sum[key] = data.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
            }
        }
        if (args._count) {
            if (typeof args._count === 'boolean') {
                result._count = data.length;
            } else {
                for (const key of Object.keys(args._count)) {
                    result._count[key] = data.filter(item => item[key] !== undefined && item[key] !== null).length;
                }
            }
        }
        // Basic average
        if (args._avg) {
            for (const key of Object.keys(args._avg)) {
                const sum = data.reduce((s, item) => s + (Number(item[key]) || 0), 0);
                result._avg[key] = data.length > 0 ? sum / data.length : 0;
            }
        }

        return result;
    }

    async $transaction(fn: (db: any) => Promise<any>): Promise<any> {
        // Simple synchronous-like execution for JSON DB
        return await fn(db);
    }

    private matchCriteria(item: any, where: any): boolean {
        if (!where) return true;
        
        // Handle OR
        if (where.OR) {
            return where.OR.some((subWhere: any) => this.matchCriteria(item, subWhere));
        }
        // Handle AND
        if (where.AND) {
            return where.AND.every((subWhere: any) => this.matchCriteria(item, subWhere));
        }

        return Object.entries(where).every(([key, val]: [string, any]) => {
            if (val === undefined || val === null) return true;
            
            const itemVal = item[key];

            if (val && typeof val === 'object') {
                if ('equals' in val) return itemVal === val.equals;
                if ('in' in val) return val.in.includes(itemVal);
                if ('notIn' in val) return !val.notIn.includes(itemVal);
                if ('gte' in val) return new Date(itemVal) >= new Date(val.gte);
                if ('lte' in val) return new Date(itemVal) <= new Date(val.lte);
                if ('gt' in val) return new Date(itemVal) > new Date(val.gt);
                if ('lt' in val) return new Date(itemVal) < new Date(val.lt);
                if ('contains' in val) return String(itemVal).toLowerCase().includes(val.contains.toLowerCase());
                if ('not' in val) return itemVal !== val.not;
                
                // Handle 'some' for relations
                if ('some' in val) {
                    const relatedItems = item[key] || [];
                    return Array.isArray(relatedItems) && relatedItems.some((rel: any) => this.matchCriteria(rel, val.some));
                }
            }

            return itemVal === val;
        });
    }

    private async applyIncludes(item: any, include: any) {
        for (const [key, options] of Object.entries(include)) {
            if (!options) continue;

            const relationMap: any = {
                'items': 'orderItems',
                'createdBy': 'users',
                'floor': 'floors',
                'table': 'tables',
                'menuItem': 'menuItems',
                'stockItem': 'stocks',
                'restockHistory': 'stockRestockEntries',
                'recipe': 'recipeIngredients',
                'recipes': 'recipeIngredients',
                'dismissals': 'fixedAssetDismissals',
                'rooms': 'rooms',
                'stock': 'stocks',
                'user': 'users'
            };
            
            const tableName = relationMap[key] || key;
            const dbRef = new JsonDB(tableName);
            const allRelated = dbRef.read();

            let matches = [];
            if (key === 'items' || key === 'restockHistory' || key === 'recipes' || key === 'recipe' || key === 'dismissals' || key === 'rooms') {
                // One-to-many
                const foreignKeyMap: any = {
                    'items': 'orderId',
                    'restockHistory': 'stockId',
                    'recipe': 'menuItemId',
                    'recipes': 'menuItemId',
                    'dismissals': 'fixedAssetId',
                    'rooms': 'floorId'
                };
                const fk = foreignKeyMap[key];
                matches = allRelated.filter((r: any) => r[fk] === item.id);
                item[key] = matches;
            } else {
                // One-to-one / Many-to-one
                const foreignKeyMap: any = {
                    'createdBy': 'createdById',
                    'floor': 'floorId',
                    'table': 'tableId',
                    'menuItem': 'menuItemId',
                    'stockItem': 'stockItemId',
                    'stock': 'stockId',
                    'user': 'userId'
                };
                const fk = foreignKeyMap[key];
                const found = allRelated.find((r: any) => r.id === item[fk]);
                if (found) {
                    matches = [found];
                    item[key] = found;
                } else {
                    item[key] = null;
                }
            }

            // Recursive include if options is an object with its own 'include'
            if (typeof options === 'object' && (options as any).include) {
                for (const match of matches) {
                    await dbRef.applyIncludes(match, (options as any).include);
                }
            }
        }
    }

    private generateCuid() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}

function buildDb() {
    const d: any = {
        user: new JsonDB('users'),
        floor: new JsonDB('floors'),
        table: new JsonDB('tables'),
        menuItem: new JsonDB('menuItems'),
        recipeIngredient: new JsonDB('recipeIngredients'),
        order: new JsonDB('orders'),
        orderItem: new JsonDB('orderItems'),
        stock: new JsonDB('stocks'),
        stockRestockEntry: new JsonDB('stockRestockEntries'),
        category: new JsonDB('categories'),
        settings: new JsonDB('settings'),
        fixedAsset: new JsonDB('fixedAssets'),
        fixedAssetDismissal: new JsonDB('fixedAssetDismissals'),
        operationalExpense: new JsonDB('operationalExpenses'),
        room: new JsonDB('rooms'),
        service: new JsonDB('services'),
        receptionRequest: new JsonDB('receptionRequests'),
        transferRequest: new JsonDB('transferRequests'),
        storeLog: new JsonDB('storeLogs'),
        dailyExpense: new JsonDB('dailyExpenses'),
        auditLog: new JsonDB('auditLogs'),
    };
    d.$transaction = async (input: any) => {
        if (typeof input === 'function') {
            return await input(d);
        }
        if (Array.isArray(input)) {
            const results = [];
            for (const promise of input) {
                results.push(await promise);
            }
            return results;
        }
        return input;
    };
    return d;
}

let dbSingleton: ReturnType<typeof buildDb> | null = null;

export function getDb() {
    if (!dbSingleton) dbSingleton = buildDb();
    return dbSingleton;
}

/** Lazily initializes table handles on first access (avoids heavy fs sync when only importing the module). */
export const db = new Proxy({} as Record<string, unknown>, {
    get(_target, prop) {
        return Reflect.get(getDb(), prop);
    },
});
