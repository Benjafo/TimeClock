const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  formatDuration,
  parseDbDate,
  discordTimestamp,
  periodStart,
  toDbUTC,
} = require("../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("View your time tracking report")
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
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("View another user's report (Admin only)")
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
    const userId = interaction.user.id;
    const username = interaction.user.username;

    dbHelpers.getOrCreateUser(userId, username);

    // Admins may view someone else's report.
    const targetUser = interaction.options.getUser("user");
    if (
      targetUser &&
      targetUser.id !== userId &&
      !dbHelpers.isUserAdmin(userId)
    ) {
      return interaction.reply({
        content: "Only administrators can view another user's report.",
        ephemeral: true,
      });
    }
    const subjectId = targetUser ? targetUser.id : userId;
    const subjectName = targetUser ? targetUser.username : username;

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

    // Rolling period filter: /report last:3 unit:days
    const last = interaction.options.getInteger("last");
    const unit = interaction.options.getString("unit");
    let sinceUtc = null;
    let periodLabel = null;

    if (last !== null || unit !== null) {
      const amount = last ?? 1;
      const resolvedUnit = unit ?? "days";
      sinceUtc = toDbUTC(periodStart(amount, resolvedUnit));
      periodLabel = `Last ${amount} ${amount === 1 ? resolvedUnit.slice(0, -1) : resolvedUnit}`;
    }

    const entries = dbHelpers.getTimeEntries(subjectId, projectId, 50, sinceUtc);

    if (entries.length === 0) {
      const scope = projectName ? ` for project "${projectName}"` : "";
      const period = periodLabel ? ` in the ${periodLabel.toLowerCase()}` : "";
      return interaction.reply({
        content: `No time entries found${scope}${period}.`,
        ephemeral: true,
      });
    }

    const completedEntries = entries.filter((e) => e.clock_out !== null);
    const { hours, minutes } = dbHelpers.calculateTotalHours(completedEntries);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`Time Report for ${subjectName}`)
      .setDescription(
        [
          projectName ? `Project: **${projectName}**` : "All Projects",
          periodLabel ? `Period: **${periodLabel}**` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .addFields(
        {
          name: "Total Time",
          value: formatDuration(hours, minutes),
          inline: true,
        },
        {
          name: "Total Entries",
          value: entries.length.toString(),
          inline: true,
        },
        {
          name: "Completed",
          value: completedEntries.length.toString(),
          inline: true,
        },
      )
      .setTimestamp();

    const recentEntries = entries.slice(0, 10);
    let reportText = "";

    for (const entry of recentEntries) {
      const status = entry.clock_out ? "✅" : "⏱️";
      const clockIn = discordTimestamp(entry.clock_in);
      const clockOut = entry.clock_out
        ? discordTimestamp(entry.clock_out)
        : "Still clocked in";

      let duration = "";
      if (entry.clock_out) {
        const diff = parseDbDate(entry.clock_out) - parseDbDate(entry.clock_in);
        const mins = diff / (1000 * 60);
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        duration = ` (${formatDuration(h, m)})`;
      }

      reportText += `${status} **${entry.project_name}**\n`;
      reportText += `   In: ${clockIn}\n`;
      reportText += `   Out: ${clockOut}${duration}\n`;
      if (entry.notes) {
        reportText += `   📝 ${entry.notes}\n`;
      }
      reportText += `\n`;
    }

    embed.addFields({
      name: "Recent Entries",
      value: (reportText || "No entries").substring(0, 1024),
    });

    if (entries.length > 10) {
      embed.setFooter({ text: `Showing 10 of ${entries.length} entries` });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
