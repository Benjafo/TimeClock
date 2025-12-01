const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/timeclock.db';
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

const dbHelpers = {
    getOrCreateUser(discordId, username) {
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);

        if (!user) {
            db.prepare('INSERT INTO users (discord_id, username) VALUES (?, ?)').run(discordId, username);
            return db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
        }

        return user;
    },

    isUserAdmin(discordId) {
        const user = db.prepare('SELECT is_admin FROM users WHERE discord_id = ?').get(discordId);
        return user && user.is_admin === 1;
    },

    getProject(projectName) {
        return db.prepare('SELECT * FROM projects WHERE name = ?').get(projectName);
    },

    getAllProjects() {
        return db.prepare('SELECT * FROM projects ORDER BY name').all();
    },

    createProject(name, createdBy) {
        const stmt = db.prepare('INSERT INTO projects (name, created_by) VALUES (?, ?)');
        const result = stmt.run(name, createdBy);
        db.prepare('INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)').run(createdBy, result.lastInsertRowid);
        return result.lastInsertRowid;
    },

    updateProjectName(oldName, newName) {
        return db.prepare('UPDATE projects SET name = ? WHERE name = ?').run(newName, oldName);
    },

    deleteProject(projectId) {
        return db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    },

    isUserAssignedToProject(userId, projectId) {
        const assignment = db.prepare('SELECT * FROM user_projects WHERE user_id = ? AND project_id = ?').get(userId, projectId);
        return !!assignment;
    },

    assignUserToProject(userId, projectId) {
        return db.prepare('INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES (?, ?)').run(userId, projectId);
    },

    getUserOpenEntry(userId) {
        return db.prepare('SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL').get(userId);
    },

    getUserOpenEntryForProject(userId, projectId) {
        return db.prepare('SELECT * FROM time_entries WHERE user_id = ? AND project_id = ? AND clock_out IS NULL').get(userId, projectId);
    },

    clockIn(userId, projectId) {
        const stmt = db.prepare('INSERT INTO time_entries (user_id, project_id, clock_in) VALUES (?, ?, datetime("now"))');
        return stmt.run(userId, projectId);
    },

    clockOut(entryId) {
        return db.prepare('UPDATE time_entries SET clock_out = datetime("now") WHERE id = ?').run(entryId);
    },

    getTimeEntries(userId, projectId = null, limit = 100) {
        if (projectId) {
            return db.prepare(`
                SELECT te.*, p.name as project_name
                FROM time_entries te
                JOIN projects p ON te.project_id = p.id
                WHERE te.user_id = ? AND te.project_id = ?
                ORDER BY te.clock_in DESC
                LIMIT ?
            `).all(userId, projectId, limit);
        } else {
            return db.prepare(`
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
        return db.prepare(`
            SELECT te.*, p.name as project_name
            FROM time_entries te
            JOIN projects p ON te.project_id = p.id
            WHERE te.id = ?
        `).get(entryId);
    },

    updateTimeEntry(entryId, clockIn, clockOut) {
        return db.prepare('UPDATE time_entries SET clock_in = ?, clock_out = ? WHERE id = ?').run(clockIn, clockOut, entryId);
    },

    deleteTimeEntry(entryId) {
        return db.prepare('DELETE FROM time_entries WHERE id = ?').run(entryId);
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

module.exports = { db, dbHelpers };
