const { dbHelpers } = require("../database/database");
const { parseDbDate, discordTimestamp, toDbUTC } = require("./time");
const { getSetting, formatSettingValue } = require("../config/settings");

// Periodic sweeps over open time entries:
//
//  - Auto clock-out: users with the autoclockoutduration setting are clocked
//    out once it elapses, at clock_in + duration (not at sweep time, so a
//    forgotten 8-hour cap records 8 hours), with "(auto clock-out)" appended
//    to the notes and a DM sent.
//
//  - Forgotten clock-out reminder: DM users clocked in longer than
//    REMINDER_HOURS (env var, default 8; 0 disables), unless they turned the
//    longshiftnotification setting off. Reminders are tracked in memory, so a
//    restart may re-send at most one extra reminder per open entry.

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const remindedEntryIds = new Set();

function getReminderHours() {
  const hours =
    process.env.REMINDER_HOURS === undefined
      ? 8
      : Number(process.env.REMINDER_HOURS);
  return !hours || Number.isNaN(hours) ? null : hours;
}

async function runSweepOnce(client) {
  const reminderHours = getReminderHours();
  const openEntries = dbHelpers.getAllOpenEntries();
  const now = Date.now();

  for (const entry of openEntries) {
    const clockInMs = parseDbDate(entry.clock_in).getTime();

    // --- auto clock-out ---
    const durationMinutes = getSetting(entry.discord_id, "autoclockoutduration");
    if (durationMinutes && now >= clockInMs + durationMinutes * 60000) {
      const clockOutUTC = toDbUTC(new Date(clockInMs + durationMinutes * 60000));
      const notes = entry.notes
        ? `${entry.notes} (auto clock-out)`
        : "(auto clock-out)";
      dbHelpers.updateTimeEntry(entry.id, entry.clock_in, clockOutUTC, notes);

      try {
        const user = await client.users.fetch(entry.discord_id);
        await user.send(
          `⏰ You were automatically clocked out of **${entry.project_name}** ` +
            `after ${formatSettingValue("autoclockoutduration", durationMinutes)} ` +
            `(your autoclockoutduration setting).\n` +
            `In: ${discordTimestamp(entry.clock_in)}\n` +
            `Out: ${discordTimestamp(clockOutUTC)}\n` +
            `Use /editlatest if this entry needs fixing, or /config to change the setting.`,
        );
      } catch (dmError) {
        console.error(
          `Could not DM auto clock-out notice to ${entry.username}:`,
          dmError.message,
        );
      }
      continue; // entry is closed now — no reminder needed
    }

    // --- forgotten clock-out reminder ---
    if (!reminderHours) continue;
    if (remindedEntryIds.has(entry.id)) continue;
    if (clockInMs > now - reminderHours * 3600000) continue;
    if (getSetting(entry.discord_id, "longshiftnotification") === false) continue;

    remindedEntryIds.add(entry.id);
    try {
      const user = await client.users.fetch(entry.discord_id);
      await user.send(
        `⏰ You have been clocked in to **${entry.project_name}** since ` +
          `${discordTimestamp(entry.clock_in)} (${discordTimestamp(entry.clock_in, "R")}). ` +
          `If you forgot to clock out, use /clockout or fix the entry with /editlatest.`,
      );
    } catch (dmError) {
      console.error(
        `Could not DM reminder to ${entry.username}:`,
        dmError.message,
      );
    }
  }
}

function startBackgroundSweeps(client) {
  const reminderHours = getReminderHours();
  console.log(
    reminderHours
      ? `Forgotten clock-out reminders enabled (threshold: ${reminderHours}h).`
      : "Forgotten clock-out reminders disabled.",
  );
  console.log("Auto clock-out sweep enabled (per-user setting).");

  setInterval(
    () =>
      runSweepOnce(client).catch((error) =>
        console.error("Error in background sweep:", error),
      ),
    SWEEP_INTERVAL_MS,
  );
}

module.exports = { startBackgroundSweeps, runSweepOnce };
