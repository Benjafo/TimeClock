const { dbHelpers } = require("../database/database");

async function checkAdminPermission(interaction) {
  const userId = interaction.user.id;
  const isAdmin = dbHelpers.isUserAdmin(userId);

  if (!isAdmin) {
    await interaction.reply({
      content:
        "You do not have permission to use this command. Only administrators can use this command.",
      ephemeral: true,
    });
    return false;
  }

  return true;
}

function formatDuration(hours, minutes) {
  if (hours === 0 && minutes === 0) {
    return "0 minutes";
  }

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  }

  return parts.join(", ");
}

function getTimezone() {
  if (!process.env.TIMEZONE)
    throw new Error(
      "TIMEZONE environment variable is not set. Please set it to a valid IANA timezone string, e.g., 'America/New_York'.",
    );
  return process.env.TIMEZONE || "America/New_York";
}

function formatDate(dateString) {
  const date = new Date(dateString);
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
  if (typeof date === "string") date = new Date(date);
  return date.toLocaleTimeString("en-US", {
    timeZone: getTimezone(),
  });
}

function formatDateForInput(dateString) {
  const date = new Date(dateString);
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: getTimezone(),
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function localToUTC(dateString) {
  const timezone = getTimezone();
  const localDate = new Date(dateString);
  const utcString = localDate.toLocaleString("en-US", { timeZone: "UTC" });
  const localString = localDate.toLocaleString("en-US", { timeZone: timezone });
  const diff = new Date(utcString) - new Date(localString);
  const adjusted = new Date(localDate.getTime() + diff);
  return adjusted.toISOString().replace("T", " ").substring(0, 19);
}

function formatLocalDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    timeZone: getTimezone(),
  });
}

module.exports = {
  checkAdminPermission,
  formatDuration,
  formatDate,
  formatTime,
  formatDateForInput,
  localToUTC,
  formatLocalDate,
};
