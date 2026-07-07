require("dotenv").config();

function getTimezone() {
  if (!process.env.TIMEZONE)
    throw new Error(
      "TIMEZONE environment variable is not set. Please set it to a valid IANA timezone string, e.g., 'America/New_York'.",
    );
  return process.env.TIMEZONE;
}

// SQLite's datetime('now')/CURRENT_TIMESTAMP store UTC as "YYYY-MM-DD HH:MM:SS"
// with no zone marker; new Date(string) would read that as server-local time.
function parseDbDate(value) {
  if (value instanceof Date) return value;
  return new Date(value.replace(" ", "T") + "Z");
}

// Offset of `timezone` from UTC at the given instant, in ms (negative when
// the timezone is behind UTC).
function tzOffsetMs(epochMs, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epochMs));

  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUTC - epochMs;
}

// Interpret a wall-clock time (e.g. user input "2026-07-07 09:00:00") in the
// configured TIMEZONE and return the equivalent UTC "YYYY-MM-DD HH:MM:SS"
// for storage. Must not depend on the server's OS timezone.
function localToUTC(dateString) {
  const timezone = getTimezone();

  // new Date() reads the string in the server's zone, but the wall-clock
  // digits survive; re-extract them so the server zone cancels out.
  const local = new Date(dateString);
  const wallUTC = Date.UTC(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    local.getHours(),
    local.getMinutes(),
    local.getSeconds(),
  );

  // Find the instant whose wall clock in TIMEZONE matches; the second pass
  // re-evaluates the offset near DST transitions.
  let utc = wallUTC;
  for (let i = 0; i < 2; i++) {
    utc = wallUTC - tzOffsetMs(utc, timezone);
  }

  return new Date(utc).toISOString().replace("T", " ").substring(0, 19);
}

// Discord renders <t:epoch:style> in each viewer's own timezone. Only works
// in message content and embeds — not in component labels or modal fields.
function discordTimestamp(value, style = "f") {
  const date = value instanceof Date ? value : parseDbDate(value);
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

// Rolling window start: the instant `amount` hours/days/months before now.
function periodStart(amount, unit) {
  const now = new Date();
  if (unit === "hours") return new Date(now.getTime() - amount * 3600000);
  if (unit === "days") return new Date(now.getTime() - amount * 86400000);
  const d = new Date(now);
  d.setMonth(d.getMonth() - amount);
  return d;
}

// Convert a Date to the UTC "YYYY-MM-DD HH:MM:SS" format used in the DB.
function toDbUTC(date) {
  return date.toISOString().replace("T", " ").substring(0, 19);
}

function formatDate(dateString) {
  const date = parseDbDate(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: getTimezone(),
  });
}

function formatTime(date) {
  if (typeof date === "string") date = parseDbDate(date);
  return date.toLocaleTimeString("en-US", {
    timeZone: getTimezone(),
  });
}

function formatDateForInput(dateString) {
  const date = parseDbDate(dateString);
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: getTimezone(),
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function formatLocalDate(dateString) {
  const date = parseDbDate(dateString);
  return date.toLocaleDateString("en-US", {
    timeZone: getTimezone(),
  });
}

module.exports = {
  getTimezone,
  parseDbDate,
  localToUTC,
  discordTimestamp,
  periodStart,
  toDbUTC,
  formatDate,
  formatTime,
  formatDateForInput,
  formatLocalDate,
};
