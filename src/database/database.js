const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/timeclock.db';

// Initialize sql.js
let db;

async function initializeDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    return db;
}

// Helper to save database to disk
function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
}

// Wrapper to mimic better-sqlite3 API
class PreparedStatement {
    constructor(db, sql) {
        this.db = db;
        this.sql = sql;
    }

    get(...params) {
        const stmt = this.db.prepare(this.sql);
        stmt.bind(params);
        if (stmt.step()) {
            const result = stmt.getAsObject();
            stmt.free();
            return result;
        }
        stmt.free();
        return null;
    }

    all(...params) {
        const stmt = this.db.prepare(this.sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }

    run(...params) {
        const stmt = this.db.prepare(this.sql);
        stmt.bind(params);
        stmt.step();
        const lastInsertRowid = this.db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0];
        stmt.free();
        saveDatabase(); // Save after each write operation
        return { lastInsertRowid, changes: this.db.getRowsModified() };
    }
}

// Wrapper for db.prepare()
function prepare(sql) {
    return new PreparedStatement(db, sql);
}

// Initialize database synchronously (for backwards compatibility)
// Note: This will be called at module load
let dbInitialized = false;
(async () => {
    await initializeDatabase();
    dbInitialized = true;
})();

const dbHelpers = {
    getOrCreateUser(discordId, username) {
        const user = prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);

        if (!user) {
            prepare('INSERT INTO users (discord_id, username) VALUES (?, ?)').run(discordId, username);
            return prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
        }

        return user;
    },

    isUserAdmin(discordId) {
        const user = prepare('SELECT is_admin FROM users WHERE discord_id = ?').get(discordId);
        return user && user.is_admin === 1;
    },

    getProject(projectName) {
        return prepare('SELECT * FROM projects WHERE name = ?').get(projectName);
    },

    getAllProjects() {
        return prepare('SELECT * FROM projects ORDER BY name').all();
    },

    createProject(name, createdBy) {
        const stmt = prepare('INSERT INTO projects (name, created_by) VALUES (?, ?)');
        const result = stmt.run(name, createdBy);
        prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)').run(createdBy, result.lastInsertRowid);
        return result.lastInsertRowid;
    },

    updateProjectName(oldName, newName) {
        return prepare('UPDATE projects SET name = ? WHERE name = ?').run(newName, oldName);
    },

    deleteProject(projectId) {
        return prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    },

    isUserAssignedToProject(userId, projectId) {
        const assignment = prepare('SELECT * FROM user_projects WHERE user_id = ? AND project_id = ?').get(userId, projectId);
        return !!assignment;
    },

    assignUserToProject(userId, projectId) {
        return prepare('INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES (?, ?)').run(userId, projectId);
    },

    getUserOpenEntry(userId) {
        return prepare('SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL').get(userId);
    },

    getUserOpenEntryForProject(userId, projectId) {
        return prepare('SELECT * FROM time_entries WHERE user_id = ? AND project_id = ? AND clock_out IS NULL').get(userId, projectId);
    },

    clockIn(userId, projectId) {
        const stmt = prepare('INSERT INTO time_entries (user_id, project_id, clock_in) VALUES (?, ?, datetime("now"))');
        return stmt.run(userId, projectId);
    },

    clockOut(entryId) {
        return prepare('UPDATE time_entries SET clock_out = datetime("now") WHERE id = ?').run(entryId);
    },

    getTimeEntries(userId, projectId = null, limit = 100) {
        if (projectId) {
            return prepare(`
                SELECT te.*, p.name as project_name
                FROM time_entries te
                JOIN projects p ON te.project_id = p.id
                WHERE te.user_id = ? AND te.project_id = ?
                ORDER BY te.clock_in DESC
                LIMIT ?
            `).all(userId, projectId, limit);
        } else {
            return prepare(`
                SELECT te.*, p.name as project_name
                FROM time_entries te
                JOIN projects p ON te.project_id = p.id
                WHERE te.user_id = ?
                ORDER BY te.clock_in DESC
                LIMIT ?
            `).all(userId, limit);
        }
    },

    getTimeEntry(entryId) {
        return prepare(`
            SELECT te.*, p.name as project_name
            FROM time_entries te
            JOIN projects p ON te.project_id = p.id
            WHERE te.id = ?
        `).get(entryId);
    },

    updateTimeEntry(entryId, clockIn, clockOut) {
        return prepare('UPDATE time_entries SET clock_in = ?, clock_out = ? WHERE id = ?').run(clockIn, clockOut, entryId);
    },

    deleteTimeEntry(entryId) {
        return prepare('DELETE FROM time_entries WHERE id = ?').run(entryId);
    },

    calculateTotalHours(entries) {
        let totalMinutes = 0;

        for (const entry of entries) {
            if (entry.clock_out) {
                const clockIn = new Date(entry.clock_in);
                const clockOut = new Date(entry.clock_out);
                const diff = clockOut - clockIn;
                totalMinutes += diff / (1000 * 60);
            }
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);

        return { hours, minutes, totalMinutes };
    }
};

module.exports = { db, dbHelpers, initializeDatabase, saveDatabase };
