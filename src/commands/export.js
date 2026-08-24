const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  parseDbDate,
  formatDateForInput,
  periodStart,
  toDbUTC,
  getTimezone,
} = require("../utils/permissions");

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// userId: the requester — CSV timestamps are rendered in their timezone.
function buildCsv(entries, includeUsername, userId) {
  const header = [
    ...(includeUsername ? ["username"] : []),
    "project",
    `clock_in (${getTimezone(userId)})`,
    `clock_out (${getTimezone(userId)})`,
    "hours",
    "notes",
  ];

  const rows = entries.map((entry) => {
    const hours = entry.clock_out
      ? (
          (parseDbDate(entry.clock_out) - parseDbDate(entry.clock_in)) /
          3600000
        ).toFixed(2)
      : "";

    return [
      ...(includeUsername ? [entry.username] : []),
      entry.project_name,
      formatDateForInput(entry.clock_in, userId),
      entry.clock_out ? formatDateForInput(entry.clock_out, userId) : "",
      hours,
      entry.notes || "",
    ];
  });

  return [header, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("export")
    .setDescription("Export time entries as a CSV file")
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("Filter by specific project (optional)")
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("last")
        .setDescription("Only include entries from the last N units of time")
        .setMinValue(1)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("unit")
        .setDescription("Time unit for the 'last' option (default: days)")
        .setRequired(false)
        .addChoices(
          { name: "Hours", value: "hours" },
          { name: "Days", value: "days" },
          { name: "Months", value: "months" },
        ),
    )
    .addBooleanOption((option) =>
      option
        .setName("team")
        .setDescription("Export the whole team's entries (Admin only)")
        .setRequired(false),
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const projects = dbHelpers.getAllProjects();
    const filtered = projects
      .filter((project) =>
        project.name.toLowerCase().includes(focusedValue.toLowerCase()),
      )
      .slice(0, 25);

    await interaction.respond(
      filtered.map((project) => ({ name: project.name, value: project.name })),
    );
  },

  async execute(interaction) {
    const projectName = interaction.options.getString("project");
    const last = interaction.options.getInteger("last");
    const unit = interaction.options.getString("unit");
    const team = interaction.options.getBoolean("team") || false;
    const userId = interaction.user.id;

    dbHelpers.getOrCreateUser(userId, interaction.user.username);

    if (team && !dbHelpers.isUserAdmin(userId)) {
      return interaction.reply({
        content: "Only administrators can export the whole team's entries.",
        ephemeral: true,
      });
    }

    let projectId = null;
    if (projectName) {
      const project = dbHelpers.getProject(projectName);
      if (!project) {
        return interaction.reply({
          content: `Project "${projectName}" does not exist.`,
          ephemeral: true,
        });
      }
      projectId = project.id;
    }

    let sinceUtc = null;
    if (last !== null || unit !== null) {
      sinceUtc = toDbUTC(periodStart(last ?? 1, unit ?? "days"));
    }

    const entries = team
      ? dbHelpers.getTeamTimeEntries(projectId, sinceUtc)
      : dbHelpers.getTimeEntries(userId, projectId, 10000, sinceUtc);

    if (entries.length === 0) {
      return interaction.reply({
        content: "No time entries found for the selected filters.",
        ephemeral: true,
      });
    }

    const csv = buildCsv(entries, team, userId);
    const file = new AttachmentBuilder(Buffer.from(csv, "utf8"), {
      name: `timeclock-export-${team ? "team" : interaction.user.username}.csv`,
    });

    await interaction.reply({
      content: `Exported ${entries.length} time entr${entries.length === 1 ? "y" : "ies"}.`,
      files: [file],
      ephemeral: true,
    });
  },
};
