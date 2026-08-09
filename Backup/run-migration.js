/**
 * ChatApp Pro - Database Migration Script
 * Run with: node run-migration.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ============================================
// SET YOUR DATABASE URL HERE
// ============================================
const DATABASE_URL = "postgresql://postgres:ZfGxuzJJIjphLeQXKjWqMZGAxTYetrNu@postgres.railway.internal:5432/railway";

// ============================================
// Read migration SQL
// ============================================
const migrationSQL = fs.readFileSync(
    path.join(__dirname, 'migration.sql'),
    'utf8'
);

// ============================================
// Main function
// ============================================
async function runMigration() {
    console.log('🚀 Starting database migration...');
    console.log('📡 Connecting to Railway PostgreSQL...');

    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('✅ Connected to database');

        // Split SQL into statements
        const statements = migrationSQL
            .split(';')
            .filter(stmt => stmt.trim().length > 0);

        console.log(`📝 Found ${statements.length} SQL statements`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const sql = statements[i].trim() + ';';
            try {
                await client.query(sql);
                console.log(`  ✅ ${i + 1}/${statements.length} done`);
            } catch (err) {
                if (err.message.includes('already exists')) {
                    console.log(`  ⚠️ ${i + 1}/${statements.length} skipped (exists)`);
                } else {
                    throw err;
                }
            }
        }

        console.log('✅ Migration completed!');
        client.release();

        // Verify tables
        console.log('\n📋 Verifying tables...');
        const verifyClient = await pool.connect();
        const result = await verifyClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'messages', 'dm_requests')
        `);
        verifyClient.release();

        console.log('✅ Tables created:');
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        await pool.end();

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

// Run it
runMigration();