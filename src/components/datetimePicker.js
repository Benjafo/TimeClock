const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
} = require("discord.js");
const { dbHelpers } = require("../database/database");
const { getSetting } = require("../config/settings");
const {
  getTimezone,
  localToUTC,
  formatDateForInput,
  discordTimestamp,
  parseDbDate,
} = require("../utils/time");

// Staged date/time picker rendered as select menus on an ephemeral message.
//
// Why a message and not a modal: a full datetime needs four selects (date,
// hour, minute tens, minute ones), a modal holds at most five components, and
// a modal submit cannot open another modal — so clock-in + clock-out cannot
// be chained through modals. Messages have none of those limits and let the
// same message morph through Step 1 (clock-in) -> Step 2 (clock-out) -> done.
//
// The date select covers the last 24 days; "Other date…" (and the textbox
// date/time preferences from /config) fall back to small Label-based modals.
//
// Sessions are in-memory, one per user (starting a new picker replaces any
// previous one), and expire after 15 minutes of inactivity.

const SESSION_TTL_MS = 15 * 60 * 1000;
const DATE_OPTION_DAYS = 24;
const OTHER_DATE = "__other";

const sessions = new Map(); // userId -> session

function usesTextboxOnly(userId) {
  return (
    getSetting(userId, "datepicker") === "textbox" &&
    getSetting(userId, "timepicker") === "textbox"
  );
}

// --- wall-clock parts helpers (all in the session user's timezone) ---

function partsFromLocalString(str) {
  const [date, time] = str.split(" ");
  const [hour, minute, second] = time.split(":").map(Number);
  return { date, hour, minute, second };
}

// Seconds are zeroed: picker-created values are minute-precise; only values
// loaded from an existing entry keep their stored seconds.
function partsNow(userId) {
  return { ...partsFromLocalString(formatDateForInput(new Date(), userId)), second: 0 };
}

const pad = (n) => String(n).padStart(2, "0");

function partsToLocalString(p) {
  return `${p.date} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

function friendlyDate(dateStr) {
  // Parse as UTC noon so the printed calendar date never shifts.
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function displayParts(p) {
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const ampm = p.hour < 12 ? "AM" : "PM";
  const secs = p.second ? `:${pad(p.second)}` : "";
  return `${friendlyDate(p.date)}, ${h12}:${pad(p.minute)}${secs} ${ampm}`;
}

// --- session management ---

function getSession(interaction) {
  const session = sessions.get(interaction.user.id);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(interaction.user.id);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

async function replyExpired(interaction) {
  const payload = {
    content: "This picker session expired — run the command again.",
    components: [],
  };
  if (interaction.isModalSubmit() && !interaction.isFromMessage()) {
    return interaction.reply({ ...payload, ephemeral: true });
  }
  return interaction.update(payload);
}

// opts: { kind: 'edit'|'add', entry?, projectId?, projectName?, via: 'reply'|'update' }
// 'edit' expects an entry row (with project_name); 'add' expects projectId/projectName.
async function startPicker(interaction, opts) {
  const userId = interaction.user.id;

  const session = {
    userId,
    kind: opts.kind,
    entryId: opts.entry ? opts.entry.id : null,
    projectId: opts.kind === "add" ? opts.projectId : opts.entry.project_id,
    projectName: opts.kind === "add" ? opts.projectName : opts.entry.project_name,
    ownerId: opts.entry ? opts.entry.user_id : userId,
    stage: "in",
    in: opts.entry
      ? partsFromLocalString(formatDateForInput(opts.entry.clock_in, userId))
      : partsNow(userId),
    out:
      opts.entry && opts.entry.clock_out
        ? partsFromLocalString(formatDateForInput(opts.entry.clock_out, userId))
        : partsNow(userId),
    outEnabled: opts.kind === "add" ? true : !!(opts.entry && opts.entry.clock_out),
    notes: (opts.entry && opts.entry.notes) || null,
    dateUi: getSetting(userId, "datepicker") === "ui",
    timeUi: getSetting(userId, "timepicker") === "ui",
    error: null,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  sessions.set(userId, session);

  if (opts.via === "update") {
    return interaction.update(render(session));
  }
  return interaction.reply({ ...render(session), ephemeral: true });
}

// --- rendering ---

function buildDateOptions(session, active) {
  const options = [];
  const seen = new Set();
  const now = Date.now();

  for (let k = 0; k < DATE_OPTION_DAYS; k++) {
    const dateStr = formatDateForInput(
      new Date(now - k * 86400000),
      session.userId,
    ).slice(0, 10);
    if (seen.has(dateStr)) continue;
    seen.add(dateStr);

    let label = friendlyDate(dateStr);
    if (k === 0) label = `Today — ${label}`;
    else if (k === 1) label = `Yesterday — ${label}`;
    options.push({ label, value: dateStr });
  }

  // Keep the currently selected date visible even when it is outside the
  // window (came from "Other date…" or an old entry).
  if (!seen.has(active.date)) {
    options.pop();
    options.unshift({ label: friendlyDate(active.date), value: active.date });
  }

  options.push({ label: "Other date…", value: OTHER_DATE });

  return options.map((o) => ({ ...o, default: o.value === active.date }));
}

function buildHourOptions(active) {
  const options = [];
  for (let h = 0; h < 24; h++) {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h < 12 ? "AM" : "PM";
    options.push({
      label: `${h12} ${ampm} (${pad(h)}:00)`,
      value: String(h),
      default: h === active.hour,
    });
  }
  return options;
}

function buildMinuteTensOptions(active) {
  const tens = Math.floor(active.minute / 10);
  return [0, 1, 2, 3, 4, 5].map((t) => ({
    label: `Minutes: :${t}0–:${t}9`,
    value: String(t),
    default: t === tens,
  }));
}

function buildMinuteOnesOptions(active) {
  const ones = active.minute % 10;
  return Array.from({ length: 10 }, (_, o) => ({
    label: `Minute ones digit: ${o}`,
    value: String(o),
    default: o === ones,
  }));
}

function select(customId, placeholder, options) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options),
  );
}

function button(customId, label, style) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style);
}

function render(session) {
  const timezone = getTimezone(session.userId);
  const active = session.stage === "in" ? session.in : session.out;

  const title =
    session.kind === "add"
      ? `Add entry — **${session.projectName}**`
      : `Edit entry — **${session.projectName}**`;
  const stageLabel =
    session.stage === "in"
      ? "Step 1/2 — set the **clock-in** time"
      : "Step 2/2 — set the **clock-out** time";

  let body = `🕐 Clock-in: **${displayParts(session.in)}**\n`;
  body += session.outEnabled
    ? `🕕 Clock-out: **${displayParts(session.out)}**`
    : "🕕 Clock-out: *none (still clocked in)*";
  if (session.notes) body += `\n📝 ${session.notes}`;

  const content = [
    title,
    `${stageLabel} (times in ${timezone})`,
    session.error ? `⚠️ ${session.error}` : null,
    body,
  ]
    .filter(Boolean)
    .join("\n");
  session.error = null;

  const rows = [];
  if (session.dateUi) {
    rows.push(select("dtp_date", "Date", buildDateOptions(session, active)));
  }
  if (session.timeUi) {
    rows.push(select("dtp_hour", "Hour", buildHourOptions(active)));
    rows.push(select("dtp_min10", "Minutes (tens)", buildMinuteTensOptions(active)));
    rows.push(select("dtp_min1", "Minutes (ones)", buildMinuteOnesOptions(active)));
  }

  const buttons = [];
  if (session.stage === "in") {
    buttons.push(button("dtp_next", "Next →", ButtonStyle.Primary));
  } else {
    buttons.push(button("dtp_back", "← Back", ButtonStyle.Secondary));
    buttons.push(button("dtp_save", "Save", ButtonStyle.Success));
    if (session.kind === "edit") {
      buttons.push(
        button(
          "dtp_noout",
          session.outEnabled ? "No clock-out" : "Set clock-out",
          ButtonStyle.Secondary,
        ),
      );
    }
  }
  if (!session.dateUi) buttons.push(button("dtp_setdate", "Set date…", ButtonStyle.Secondary));
  if (!session.timeUi) buttons.push(button("dtp_settime", "Set time…", ButtonStyle.Secondary));
  if (session.stage === "out") buttons.push(button("dtp_notes", "Notes…", ButtonStyle.Secondary));
  buttons.push(button("dtp_cancel", "Cancel", ButtonStyle.Danger));

  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  return { content, components: rows };
}

// --- fallback modals (Label-based) ---

function labeledInput(label, description, textInput) {
  const wrapped = new LabelBuilder().setLabel(label).setTextInputComponent(textInput);
  if (description) wrapped.setDescription(description);
  return wrapped;
}

function showDateModal(interaction, active) {
  const input = new TextInputBuilder()
    .setCustomId("date")
    .setStyle(TextInputStyle.Short)
    .setValue(active.date)
    .setRequired(true);

  const modal = new ModalBuilder()
    .setCustomId("dtp_datemodal")
    .setTitle("Set Date")
    .addLabelComponents(labeledInput("Date", "Format: YYYY-MM-DD", input));

  return interaction.showModal(modal);
}

function showTimeModal(interaction, active) {
  const input = new TextInputBuilder()
    .setCustomId("time")
    .setStyle(TextInputStyle.Short)
    .setValue(`${pad(active.hour)}:${pad(active.minute)}:${pad(active.second)}`)
    .setRequired(true);

  const modal = new ModalBuilder()
    .setCustomId("dtp_timemodal")
    .setTitle("Set Time")
    .addLabelComponents(labeledInput("Time", "Format: HH:MM or HH:MM:SS (24-hour)", input));

  return interaction.showModal(modal);
}

function showNotesModal(interaction, session) {
  const input = new TextInputBuilder()
    .setCustomId("notes")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);
  if (session.notes) input.setValue(session.notes);

  const modal = new ModalBuilder()
    .setCustomId("dtp_notesmodal")
    .setTitle("Entry Notes")
    .addLabelComponents(labeledInput("Notes", "What did you work on? (optional)", input));

  return interaction.showModal(modal);
}

// --- saving ---

async function doSave(interaction, session) {
  const inLocal = partsToLocalString(session.in);
  const outLocal = session.outEnabled ? partsToLocalString(session.out) : null;

  // Same-timezone wall-clock strings compare correctly as strings.
  if (outLocal && outLocal <= inLocal) {
    session.error = "Clock out time must be after clock in time.";
    return interaction.update(render(session));
  }

  const inUTC = localToUTC(inLocal, session.userId);
  const outUTC = outLocal ? localToUTC(outLocal, session.userId) : null;

  sessions.delete(session.userId);

  if (session.kind === "edit") {
    const entry = dbHelpers.getTimeEntry(session.entryId);
    if (!entry) {
      return interaction.update({
        content: "Time entry not found (it may have been deleted).",
        components: [],
      });
    }
    if (
      entry.user_id !== session.userId &&
      !dbHelpers.isUserAdmin(session.userId)
    ) {
      return interaction.update({
        content: "You can only edit your own time entries.",
        components: [],
      });
    }

    dbHelpers.updateTimeEntry(session.entryId, inUTC, outUTC, session.notes);

    const whose =
      entry.user_id === session.userId ? "" : ` (for <@${entry.user_id}>)`;
    return interaction.update({
      content:
        `Time entry updated successfully!${whose}\n` +
        `**${entry.project_name}**\n` +
        `In: ${discordTimestamp(inUTC)}\n` +
        `Out: ${outUTC ? discordTimestamp(outUTC) : "Not clocked out"}` +
        (session.notes ? `\n📝 ${session.notes}` : ""),
      components: [],
    });
  }

  // kind === 'add' — re-check the project since the session may outlive it.
  const project = dbHelpers.getProjectById(session.projectId);
  if (!project) {
    return interaction.update({
      content: "Project not found (it may have been deleted).",
      components: [],
    });
  }
  if (!dbHelpers.isUserAssignedToProject(session.userId, session.projectId)) {
    return interaction.update({
      content: `You are not assigned to project "${project.name}".`,
      components: [],
    });
  }

  dbHelpers.createTimeEntry(
    session.userId,
    session.projectId,
    inUTC,
    outUTC,
    session.notes,
  );

  const diff = parseDbDate(outUTC) - parseDbDate(inUTC);
  const totalMinutes = diff / (1000 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const durationParts = [];
  if (hours > 0) durationParts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (minutes > 0 || hours === 0)
    durationParts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);

  return interaction.update({
    content:
      `Added a time entry for **${project.name}**.\n` +
      `In: ${discordTimestamp(inUTC)}\n` +
      `Out: ${discordTimestamp(outUTC)}\n` +
      `Time worked: ${durationParts.join(", ")}` +
      (session.notes ? `\n📝 ${session.notes}` : ""),
    components: [],
  });
}

// --- interaction handlers (routed via the dtp_ prefix) ---

module.exports = {
  componentPrefixes: ["dtp_"],
  startPicker,
  usesTextboxOnly,

  async handleSelectMenu(interaction) {
    const session = getSession(interaction);
    if (!session) return replyExpired(interaction);

    const active = session.stage === "in" ? session.in : session.out;
    const value = interaction.values[0];

    switch (interaction.customId) {
      case "dtp_date":
        if (value === OTHER_DATE) return showDateModal(interaction, active);
        active.date = value;
        break;
      case "dtp_hour":
        active.hour = Number(value);
        break;
      case "dtp_min10":
        active.minute = Number(value) * 10 + (active.minute % 10);
        break;
      case "dtp_min1":
        active.minute = Math.floor(active.minute / 10) * 10 + Number(value);
        break;
      default:
        return;
    }

    if (session.stage === "out") session.outEnabled = true;
    await interaction.update(render(session));
  },

  async handleButton(interaction) {
    const session = getSession(interaction);
    if (!session) return replyExpired(interaction);

    const active = session.stage === "in" ? session.in : session.out;

    switch (interaction.customId) {
      case "dtp_next":
        session.stage = "out";
        return interaction.update(render(session));
      case "dtp_back":
        session.stage = "in";
        return interaction.update(render(session));
      case "dtp_save":
        return doSave(interaction, session);
      case "dtp_noout":
        session.outEnabled = !session.outEnabled;
        return interaction.update(render(session));
      case "dtp_setdate":
        return showDateModal(interaction, active);
      case "dtp_settime":
        return showTimeModal(interaction, active);
      case "dtp_notes":
        return showNotesModal(interaction, session);
      case "dtp_cancel":
        sessions.delete(session.userId);
        return interaction.update({
          content: "Cancelled — nothing was changed.",
          components: [],
        });
      default:
        return;
    }
  },

  async handleModalSubmit(interaction) {
    const session = getSession(interaction);
    if (!session) return replyExpired(interaction);

    const active = session.stage === "in" ? session.in : session.out;

    if (interaction.customId === "dtp_datemodal") {
      const value = interaction.fields.getTextInputValue("date").trim();
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        isNaN(new Date(`${value}T00:00:00Z`).getTime())
      ) {
        session.error = `\`${value}\` is not a valid date — use YYYY-MM-DD.`;
      } else {
        active.date = value;
        if (session.stage === "out") session.outEnabled = true;
      }
    } else if (interaction.customId === "dtp_timemodal") {
      const value = interaction.fields.getTextInputValue("time").trim();
      const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      const [hour, minute, second] = match
        ? [Number(match[1]), Number(match[2]), Number(match[3] || 0)]
        : [NaN, NaN, NaN];
      if (!match || hour > 23 || minute > 59 || second > 59) {
        session.error = `\`${value}\` is not a valid time — use HH:MM or HH:MM:SS (24-hour).`;
      } else {
        active.hour = hour;
        active.minute = minute;
        active.second = second;
        if (session.stage === "out") session.outEnabled = true;
      }
    } else if (interaction.customId === "dtp_notesmodal") {
      session.notes = interaction.fields.getTextInputValue("notes") || null;
    } else {
      return;
    }

    if (interaction.isFromMessage()) {
      return interaction.update(render(session));
    }
    return interaction.reply({ ...render(session), ephemeral: true });
  },
};
