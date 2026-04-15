const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./shoes.db', (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

db.serialize(() => {
    db.run(`PRAGMA foreign_keys = ON`);

    //////////////////// NETWORKS ////////////////////

    db.run(`
        CREATE TABLE IF NOT EXISTS networks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            join_code TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL DEFAULT ''
        )
    `);

    // Safely add password column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE networks ADD COLUMN password TEXT NOT NULL DEFAULT ''`, () => {});

    //////////////////// NETWORK MEMBERS ////////////////////

    db.run(`
        CREATE TABLE IF NOT EXISTS network_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            network_id INTEGER NOT NULL,
            store_name TEXT NOT NULL,
            store_number TEXT NOT NULL,
            is_creator INTEGER DEFAULT 0,
            UNIQUE(network_id, store_name, store_number),
            FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE
        )
    `);

    // Safely add is_creator column if it doesn't exist
    db.run(`ALTER TABLE network_members ADD COLUMN is_creator INTEGER DEFAULT 0`, () => {});

    //////////////////// SHOES ////////////////////

    db.run(`
        CREATE TABLE IF NOT EXISTS shoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            network_id INTEGER NOT NULL,
            store_name TEXT NOT NULL,
            store_number TEXT NOT NULL,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            sku TEXT,
            gender TEXT NOT NULL CHECK (gender IN ('men', 'women', 'kids')),
            size REAL NOT NULL CHECK (size > 0),
            color TEXT NOT NULL,
            side TEXT NOT NULL CHECK (side IN ('left', 'right')),
            original_price REAL NOT NULL DEFAULT 0 CHECK (original_price >= 0),
            image_path TEXT,
            matched INTEGER NOT NULL DEFAULT 0 CHECK (matched IN (0, 1)),
            FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE
        )
    `);

    // Safely add new columns if they don't exist yet (for existing databases)
    db.run(`ALTER TABLE shoes ADD COLUMN condition TEXT NOT NULL DEFAULT 'new'`, () => {});
    db.run(`ALTER TABLE shoes ADD COLUMN price_type TEXT NOT NULL DEFAULT 'original'`, () => {});

    //////////////////// PENDING MATCH REQUESTS ////////////////////

    db.run(`
        CREATE TABLE IF NOT EXISTS pending_match_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            network_id INTEGER NOT NULL,
            shoe1_id INTEGER NOT NULL,
            shoe2_id INTEGER NOT NULL,
            requesting_store_name TEXT NOT NULL,
            requesting_store_number TEXT NOT NULL,
            target_store_name TEXT NOT NULL,
            target_store_number TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
            requested_by TEXT,
            request_note TEXT,
            requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            responded_at DATETIME,
            responded_by TEXT,
            response_note TEXT,
            UNIQUE(shoe1_id, shoe2_id, status),
            FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE,
            FOREIGN KEY (shoe1_id) REFERENCES shoes(id) ON DELETE CASCADE,
            FOREIGN KEY (shoe2_id) REFERENCES shoes(id) ON DELETE CASCADE
        )
    `);

    //////////////////// CONFIRMED MATCHES ////////////////////

    db.run(`
        CREATE TABLE IF NOT EXISTS confirmed_matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            network_id INTEGER NOT NULL,
            shoe1_id INTEGER NOT NULL,
            shoe2_id INTEGER NOT NULL,
            confirming_store_name TEXT NOT NULL,
            confirming_store_number TEXT NOT NULL,
            confirmed_by TEXT NOT NULL,
            recovered_value REAL NOT NULL DEFAULT 0 CHECK (recovered_value >= 0),
            confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(shoe1_id, shoe2_id),
            FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE,
            FOREIGN KEY (shoe1_id) REFERENCES shoes(id) ON DELETE CASCADE,
            FOREIGN KEY (shoe2_id) REFERENCES shoes(id) ON DELETE CASCADE
        )
    `);

    //////////////////// INDEXES ////////////////////

    db.run(`CREATE INDEX IF NOT EXISTS idx_shoes_match_lookup ON shoes (network_id, matched, brand, model, gender, size, side)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_shoes_store ON shoes (network_id, store_name, store_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_confirmed_matches_network ON confirmed_matches (network_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_network_members_network ON network_members (network_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_pending_match_requests_network ON pending_match_requests (network_id, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_pending_match_requests_target_store ON pending_match_requests (network_id, target_store_name, target_store_number, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_pending_match_requests_requesting_store ON pending_match_requests (network_id, requesting_store_name, requesting_store_number, status)`);
});

module.exports = db;