const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const dbPath = process.env.DB_PATH || "./tmp/timeclock.tmp.db";
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

(async () => {
  const SQL = await initSqlJs();

  const db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();

  console.log("Creating database tables...");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        discord_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users(discord_id)
    );

    CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        clock_in DATETIME NOT NULL,
        clock_out DATETIME,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(discord_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_projects (
        user_id TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, project_id),
        FOREIGN KEY (user_id) REFERENCES users(discord_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
    CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);
    CREATE INDEX IF NOT EXISTS idx_time_entries_open ON time_entries(user_id, clock_out) WHERE clock_out IS NULL;
  `);

  const adminId = process.env.ADMIN_USER_ID;
  if (adminId) {
    const stmt = db.prepare(
      "INSERT OR IGNORE INTO users (discord_id, username, is_admin) VALUES (?, ?, 1)",
    );
    stmt.run([adminId, "Admin"]);
    stmt.free();
    console.log(`Admin user ${adminId} initialized.`);
  }

  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  db.close();

  console.log("Database setup complete!");
})();
