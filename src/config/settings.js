const { dbHelpers } = require("../database/database");

// Single source of truth for per-user settings. /config renders and validates
// from these definitions, so adding a setting here is all that's needed.
//
// Storage is the user_settings key-value table; values are strings. Types:
//   choice   - one of `choices`
//   boolean  - stored as "true"/"false"
//   duration - stored as total minutes
//   timezone - IANA zone name; null falls back to the TIMEZONE env var
//   internal - not settable via /config set (has its own command), shown in view
const SETTING_DEFS = {
  datepicker: {
    type: "choice",
    choices: ["ui", "textbox"],
    default: "ui",
    description: "How dates are entered when adding or editing time entries",
  },
  timepicker: {
    type: "choice",
    choices: ["ui", "textbox"],
    default: "ui",
    description: "How times are entered when adding or editing time entries",
  },
  autoclockoutduration: {
    type: "duration",
    units: ["minutes", "hours", "days"],
    default: null,
    description: "Automatically clock out after this long (off when not set)",
  },
  longshiftnotification: {
    type: "boolean",
    default: true,
    description: "DM me when I stay clocked in past the long-shift threshold",
  },
  timezone: {
    type: "timezone",
    default: null,
    description: "IANA timezone for entering and displaying dates (server default when not set)",
  },
  defaultproject: {
    type: "internal",
    default: null,
    description: "Project /clockin uses when none is given (set via /setdefaultproject)",
  },
};

function getDef(name) {
  const def = SETTING_DEFS[name];
  if (!def) throw new Error(`Unknown setting: ${name}`);
  return def;
}

function parseValue(def, raw) {
  if (raw === null || raw === undefined) return def.default;
  if (def.type === "boolean") return raw === "true";
  if (def.type === "duration") return Number(raw);
  return raw;
}

// Returns the typed value, falling back to the setting's default.
function getSetting(userId, name) {
  return parseValue(getDef(name), dbHelpers.getUserSetting(userId, name));
}

// value === null clears the stored row, reverting to the default.
function setSetting(userId, name, value) {
  getDef(name);
  dbHelpers.setUserSetting(
    userId,
    name,
    value === null || value === undefined ? null : String(value),
  );
}

// All settings for a user as { name: typedValue }, defaults applied.
function getAllSettings(userId) {
  const raw = dbHelpers.getAllUserSettings(userId);
  const settings = {};
  for (const name of Object.keys(SETTING_DEFS)) {
    settings[name] = parseValue(SETTING_DEFS[name], raw[name] ?? null);
  }
  return settings;
}

// Human-readable value for /config view (durations in the largest even unit).
function formatSettingValue(name, value) {
  const def = getDef(name);
  if (value === null || value === undefined) return "not set";
  if (def.type === "boolean") return value ? "true" : "false";
  if (def.type === "duration") {
    if (value % 1440 === 0)
      return `${value / 1440} day${value === 1440 ? "" : "s"}`;
    if (value % 60 === 0) return `${value / 60} hour${value === 60 ? "" : "s"}`;
    return `${value} minute${value === 1 ? "" : "s"}`;
  }
  return String(value);
}

module.exports = {
  SETTING_DEFS,
  getSetting,
  setSetting,
  getAllSettings,
  formatSettingValue,
};
