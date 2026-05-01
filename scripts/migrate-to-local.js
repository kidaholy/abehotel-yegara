const { Client } = require('pg');

// INSTRUCTIONS:
// 1. Set the environment variables below or in a .env file
// 2. Run: node scripts/migrate-to-local.js

const SOURCE_URL = process.env.SOURCE_DATABASE_URL; // Supabase
const TARGET_URL = process.env.TARGET_DATABASE_URL; // Yegara

async function migrate() {
    if (!SOURCE_URL || !TARGET_URL) {
        console.error("Please set SOURCE_DATABASE_URL and TARGET_DATABASE_URL");
        process.exit(1);
    }

    const sourceClient = new Client({ connectionString: SOURCE_URL });
    const targetClient = new Client({ connectionString: TARGET_URL });

    try {
        await sourceClient.connect();
        await targetClient.connect();

        console.log("Connected to both databases.");

        // Get all tables (excluding system tables)
        const tablesRes = await sourceClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);

        const tables = tablesRes.rows.map(r => r.table_name);
        console.log(`Found ${tables.length} tables to migrate.`);

        // Disable constraints temporarily on target
        await targetClient.query('SET session_replication_role = "replica";');

        for (const table of tables) {
            console.log(`Migrating table: ${table}...`);

            // Clear target table
            await targetClient.query(`TRUNCATE TABLE "${table}" CASCADE`);

            // Fetch data from source
            const dataRes = await sourceClient.query(`SELECT * FROM "${table}"`);
            
            if (dataRes.rows.length === 0) continue;

            // Prepare insert query
            const columns = Object.keys(dataRes.rows[0]).map(c => `"${c}"`).join(', ');
            const placeholders = Object.keys(dataRes.rows[0]).map((_, i) => `$${i + 1}`).join(', ');
            const insertQuery = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders})`;

            for (const row of dataRes.rows) {
                await targetClient.query(insertQuery, Object.values(row));
            }
            console.log(`  Done: ${dataRes.rows.length} rows.`);
        }

        // Re-enable constraints
        await targetClient.query('SET session_replication_role = "origin";');
        console.log("Migration completed successfully!");

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

migrate();
