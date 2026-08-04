const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const { parseDbDate } = require("../utils/time");
require("dotenv").config();

const dbPath = process.env.DB_PATH || "./tmp/timeclock.tmp.db";

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

  // Tables added after initial release; created here so existing databases
  // pick them up on boot without re-running db:setup.
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT,
        PRIMARY KEY (user_id, key),
        FOREIGN KEY (user_id) REFERENCES users(discord_id)
    );
  `);
  saveDatabase();

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
    const lastInsertRowid = this.db.exec("SELECT last_insert_rowid() as id")[0]
      ?.values[0]?.[0];
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
  // Raw settings access; typed parsing/defaults live in src/config/settings.js
  getUserSetting(userId, key) {
    const row = prepare(
      "SELECT value FROM user_settings WHERE user_id = ? AND key = ?",
    ).get(userId, key);
    return row ? row.value : null;
  },

  setUserSetting(userId, key, value) {
    if (value === null || value === undefined) {
      return prepare(
        "DELETE FROM user_settings WHERE user_id = ? AND key = ?",
      ).run(userId, key);
    }
    return prepare(
      "INSERT OR REPLACE INTO user_settings (user_id, key, value) VALUES (?, ?, ?)",
    ).run(userId, key, String(value));
  },

  getAllUserSettings(userId) {
    const rows = prepare(
      "SELECT key, value FROM user_settings WHERE user_id = ?",
    ).all(userId);
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return settings;
  },

  getOrCreateUser(discordId, username) {
    const user = prepare("SELECT * FROM users WHERE discord_id = ?").get(
      discordId,
    );

    if (!user) {
      prepare("INSERT INTO users (discord_id, username) VALUES (?, ?)").run(
        discordId,
        username,
      );
      return prepare("SELECT * FROM users WHERE discord_id = ?").get(discordId);
    }

    return user;
  },

  isUserAdmin(discordId) {
    const user = prepare("SELECT is_admin FROM users WHERE discord_id = ?").get(
      discordId,
    );
    return user && user.is_admin === 1;
  },

  setUserAdmin(discordId, isAdmin) {
    return prepare("UPDATE users SET is_admin = ? WHERE discord_id = ?").run(
      isAdmin ? 1 : 0,
      discordId,
    );
  },

  countAdmins() {
    const row = prepare(
      "SELECT COUNT(*) as count FROM users WHERE is_admin = 1",
    ).get();
    return row ? row.count : 0;
  },

  getProject(projectName) {
    return prepare("SELECT * FROM projects WHERE name = ?").get(projectName);
  },

  getProjectById(projectId) {
    return prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  },

  getAllProjects() {
    return prepare("SELECT * FROM projects ORDER BY name").all();
  },

  createProject(name, createdBy) {
    const stmt = prepare(
      "INSERT INTO projects (name, created_by) VALUES (?, ?)",
    );
    const result = stmt.run(name, createdBy);
    prepare(
      "INSERT INTO user_projects (user_id, project_id) VALUES (?, ?)",
    ).run(createdBy, result.lastInsertRowid);
    return result.lastInsertRowid;
  },

  updateProjectName(oldName, newName) {
    return prepare("UPDATE projects SET name = ? WHERE name = ?").run(
      newName,
      oldName,
    );
  },

  deleteProject(projectId) {
    return prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  },

  isUserAssignedToProject(userId, projectId) {
    const assignment = prepare(
      "SELECT * FROM user_projects WHERE user_id = ? AND project_id = ?",
    ).get(userId, projectId);
    return !!assignment;
  },

  assignUserToProject(userId, projectId) {
    return prepare(
      "INSERT OR IGNORE INTO user_projects (user_id, project_id) VALUES (?, ?)",
    ).run(userId, projectId);
  },

  removeUserFromProject(userId, projectId) {
    return prepare(
      "DELETE FROM user_projects WHERE user_id = ? AND project_id = ?",
    ).run(userId, projectId);
  },

  getProjectMembers(projectId) {
    return prepare(`
            SELECT u.*
            FROM users u
            JOIN user_projects up ON up.user_id = u.discord_id
            WHERE up.project_id = ?
            ORDER BY u.username
        `).all(projectId);
  },

  getUserProjects(userId) {
    return prepare(`
            SELECT p.*
            FROM projects p
            JOIN user_projects up ON up.project_id = p.id
            WHERE up.user_id = ?
            ORDER BY p.name
        `).all(userId);
  },

  getUserOpenEntry(userId) {
    return prepare(
      "SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL",
    ).get(userId);
  },

  getUserOpenEntryForProject(userId, projectId) {
    return prepare(
      "SELECT * FROM time_entries WHERE user_id = ? AND project_id = ? AND clock_out IS NULL",
    ).get(userId, projectId);
  },

  clockIn(userId, projectId) {
    const stmt = prepare(
      'INSERT INTO time_entries (user_id, project_id, clock_in) VALUES (?, ?, datetime("now"))',
    );
    return stmt.run(userId, projectId);
  },

  // Insert a complete (or open, when clockOut is null) entry with explicit
  // UTC "YYYY-MM-DD HH:MM:SS" timestamps. Used by /addentry.
  createTimeEntry(userId, projectId, clockIn, clockOut = null, notes = null) {
    return prepare(
      "INSERT INTO time_entries (user_id, project_id, clock_in, clock_out, notes) VALUES (?, ?, ?, ?, ?)",
    ).run(userId, projectId, clockIn, clockOut, notes);
  },

  clockOut(entryId, note = null) {
    return prepare(
      'UPDATE time_entries SET clock_out = datetime("now"), notes = COALESCE(?, notes) WHERE id = ?',
    ).run(note, entryId);
  },

  // sinceUtc: optional UTC "YYYY-MM-DD HH:MM:SS" cutoff (see toDbUTC)
  getTimeEntries(userId, projectId = null, limit = 100, sinceUtc = null) {
    const conditions = ["te.user_id = ?"];
    const params = [userId];

    if (projectId) {
      conditions.push("te.project_id = ?");
      params.push(projectId);
    }
    if (sinceUtc) {
      conditions.push("te.clock_in >= ?");
      params.push(sinceUtc);
    }
    params.push(limit);

    return prepare(`
            SELECT te.*, p.name as project_name
            FROM time_entries te
            JOIN projects p ON te.project_id = p.id
            WHERE ${conditions.join(" AND ")}
            ORDER BY te.clock_in DESC
            LIMIT ?
        `).all(...params);
  },

  getTeamTimeEntries(projectId = null, sinceUtc = null, limit = 10000) {
    const conditions = ["1=1"];
    const params = [];

    if (projectId) {
      conditions.push("te.project_id = ?");
      params.push(projectId);
    }
    if (sinceUtc) {
      conditions.push("te.clock_in >= ?");
      params.push(sinceUtc);
    }
    params.push(limit);

    return prepare(`
            SELECT te.*, p.name as project_name, u.username
            FROM time_entries te
            JOIN projects p ON te.project_id = p.id
            JOIN users u ON te.user_id = u.discord_id
            WHERE ${conditions.join(" AND ")}
            ORDER BY te.clock_in DESC
            LIMIT ?
        `).all(...params);
  },

  getTimeEntry(entryId) {
    return prepare(`
            SELECT te.*, p.name as project_name
            FROM time_entries te
            JOIN projects p ON te.project_id = p.id
            WHERE te.id = ?
        `).get(entryId);
  },

  updateTimeEntry(entryId, clockIn, clockOut, notes = null) {
    return prepare(
      "UPDATE time_entries SET clock_in = ?, clock_out = ?, notes = ? WHERE id = ?",
    ).run(clockIn, clockOut, notes, entryId);
  },

  deleteTimeEntry(entryId) {
    return prepare("DELETE FROM time_entries WHERE id = ?").run(entryId);
  },

  calculateTotalHours(entries) {
    let totalMinutes = 0;

    for (const entry of entries) {
      if (entry.clock_out) {
        const clockIn = parseDbDate(entry.clock_in);
        const clockOut = parseDbDate(entry.clock_out);
        const diff = clockOut - clockIn;
        totalMinutes += diff / (1000 * 60);
      }
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);

    return { hours, minutes, totalMinutes };
  },

  getAllOpenEntries() {
    return prepare(`
            SELECT te.*, p.name as project_name, u.username, u.discord_id
            FROM time_entries te
            JOIN projects p ON te.project_id = p.id
            JOIN users u ON te.user_id = u.discord_id
            WHERE te.clock_out IS NULL
            ORDER BY te.clock_in DESC
        `).all();
  },

  getTeamSummary(startDate = null) {
    let entries;

    if (startDate) {
      // Stored timestamps are UTC "YYYY-MM-DD HH:MM:SS", so compare against
      // the exact UTC cutoff rather than truncating to UTC calendar days.
      const startDateStr = startDate
        .toISOString()
        .replace("T", " ")
        .substring(0, 19);
      entries = prepare(`
                SELECT te.*, p.name as project_name, u.username
                FROM time_entries te
                JOIN projects p ON te.project_id = p.id
                JOIN users u ON te.user_id = u.discord_id
                WHERE te.clock_out IS NOT NULL
                AND te.clock_in >= ?
                ORDER BY te.clock_in DESC
            `).all(startDateStr);
    } else {
      entries = prepare(`
                SELECT te.*, p.name as project_name, u.username
                FROM time_entries te
                JOIN projects p ON te.project_id = p.id
                JOIN users u ON te.user_id = u.discord_id
                WHERE te.clock_out IS NOT NULL
                ORDER BY te.clock_in DESC
            `).all();
    }

    const byPerson = {};
    const byProject = {};
    let totalMinutes = 0;

    for (const entry of entries) {
      const clockIn = parseDbDate(entry.clock_in);
      const clockOut = parseDbDate(entry.clock_out);
      const diff = clockOut - clockIn;
      const minutes = diff / (1000 * 60);

      totalMinutes += minutes;

      // By person
      if (!byPerson[entry.username]) {
        byPerson[entry.username] = { totalMinutes: 0, hours: 0, minutes: 0 };
      }
      byPerson[entry.username].totalMinutes += minutes;

      // By project
      if (!byProject[entry.project_name]) {
        byProject[entry.project_name] = {
          totalMinutes: 0,
          hours: 0,
          minutes: 0,
        };
      }
      byProject[entry.project_name].totalMinutes += minutes;
    }

    // Convert minutes to hours/minutes for display
    for (const username in byPerson) {
      const total = byPerson[username].totalMinutes;
      byPerson[username].hours = Math.floor(total / 60);
      byPerson[username].minutes = Math.floor(total % 60);
    }

    for (const projectName in byProject) {
      const total = byProject[projectName].totalMinutes;
      byProject[projectName].hours = Math.floor(total / 60);
      byProject[projectName].minutes = Math.floor(total % 60);
    }

    return {
      entries,
      byPerson,
      byProject,
      total: {
        totalHours: Math.floor(totalMinutes / 60),
        totalMinutes: Math.floor(totalMinutes % 60),
      },
    };
  },
};

module.exports = { dbHelpers, initializeDatabase, saveDatabase };
