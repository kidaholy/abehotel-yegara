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
    private static tableCache: Record<string, { data: any[], mtime: number }> = {};

    constructor(public table: string) {
        this.filePath = path.join(DATA_DIR, `${table}.json`);
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
        }
    }

    private read(): any[] {
        try {
            if (!fs.existsSync(this.filePath)) return [];
            
            // Optimization: Only read from disk if the file has changed
            const stats = fs.statSync(this.filePath);
            const mtime = stats.mtimeMs;
            
            if (JsonDB.tableCache[this.table] && JsonDB.tableCache[this.table].mtime === mtime) {
                return JsonDB.tableCache[this.table].data;
            }

            const content = fs.readFileSync(this.filePath, 'utf-8');
            const data = JSON.parse(content);
            
            // Store in static cache
            JsonDB.tableCache[this.table] = { data, mtime };
            return data;
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
        let data = [...this.read()]; // Shallow copy to prevent cache contamination

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

        // 5. Include (Joins) - Optimized bulk join after filtering
        if (args?.include && data.length > 0) {
            await this.applyIncludesBulk(data, args.include);
        }

        return data;
    }

    private async applyIncludesBulk(items: any[], include: any) {
        for (const [key, options] of Object.entries(include)) {
            if (!options) continue;

            const relationMap: any = {
                'items': { table: 'orderItems', fk: 'orderId', multiple: true },
                'createdBy': { table: 'users', fk: 'createdById', multiple: false },
                'floor': { table: 'floors', fk: 'floorId', multiple: false },
                'table': { table: 'tables', fk: 'tableId', multiple: false },
                'menuItem': { table: 'menuItems', fk: 'menuItemId', multiple: false },
                'stockItem': { table: 'stocks', fk: 'stockItemId', multiple: false },
                'restockHistory': { table: 'stockRestockEntries', fk: 'stockId', multiple: true },
                'recipes': { table: 'recipeIngredients', fk: 'menuItemId', multiple: true },
                'recipe': { table: 'recipeIngredients', fk: 'menuItemId', multiple: true },
                'dismissals': { table: 'fixedAssetDismissals', fk: 'fixedAssetId', multiple: true },
                'rooms': { table: 'rooms', fk: 'floorId', multiple: true },
                'stock': { table: 'stocks', fk: 'stockId', multiple: false },
                'user': { table: 'users', fk: 'userId', multiple: false }
            };

            const rel = relationMap[key];
            if (!rel) continue;

            const dbRef = new JsonDB(rel.table);
            const allRelated = dbRef.read();

            if (rel.multiple) {
                const map = new Map();
                for (const r of allRelated) {
                    const fkVal = r[rel.fk];
                    if (!map.has(fkVal)) map.set(fkVal, []);
                    map.get(fkVal).push(r);
                }
                for (const item of items) {
                    item[key] = [...(map.get(item.id) || [])];
                }
            } else {
                const map = new Map(allRelated.map((r: any) => [r.id, r]));
                for (const item of items) {
                    const fkVal = item[rel.fk];
                    item[key] = map.get(fkVal) || null;
                }
            }

            if (typeof options === 'object' && (options as any).include) {
                const nextItems = items.flatMap(i => i[key]).filter(Boolean);
                if (nextItems.length > 0) {
                    await dbRef.applyIncludesBulk(nextItems, (options as any).include);
                }
            }
        }
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
        if (where.OR !== undefined) {
            if (!where.OR.some((subWhere: any) => this.matchCriteria(item, subWhere))) return false;
        }
        // Handle AND
        if (where.AND !== undefined) {
            if (!where.AND.every((subWhere: any) => this.matchCriteria(item, subWhere))) return false;
        }

        return Object.entries(where).every(([key, val]: [string, any]) => {
            if (key === 'OR' || key === 'AND') return true;

            if (val === undefined || val === null) return true;
            
            const itemVal = item[key];

            if (val && typeof val === 'object') {
                if ('equals' in val && itemVal !== val.equals) return false;
                if ('in' in val && !val.in.includes(itemVal)) return false;
                if ('notIn' in val && val.notIn.includes(itemVal)) return false;
                
                // Cache Date objects for comparison to avoid repeated parsing
                const itemDate = (itemVal && (key === 'createdAt' || key === 'updatedAt' || String(itemVal).includes('T'))) ? new Date(itemVal).getTime() : null;

                if ('gte' in val && itemDate && itemDate < new Date(val.gte).getTime()) return false;
                if ('lte' in val && itemDate && itemDate > new Date(val.lte).getTime()) return false;
                if ('gt' in val && itemDate && itemDate <= new Date(val.gt).getTime()) return false;
                if ('lt' in val && itemDate && itemDate >= new Date(val.lt).getTime()) return false;
                
                if ('contains' in val && !String(itemVal).toLowerCase().includes(val.contains.toLowerCase())) return false;
                if ('not' in val && itemVal === val.not) return false;
                
                // Handle 'some' for relations
                if ('some' in val) {
                    const relatedItems = item[key] || [];
                    if (!Array.isArray(relatedItems) || !relatedItems.some((rel: any) => this.matchCriteria(rel, val.some))) return false;
                }
                
                return true;
            }

            return itemVal === val;
        });
    }

    private async applyIncludes(item: any, include: any) {
        // Redirect to bulk logic to avoid N+1 scans for single lookups
        await this.applyIncludesBulk([item], include);
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
