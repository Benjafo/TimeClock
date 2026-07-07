const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  checkAdminPermission,
  formatDuration,
  periodStart,
} = require("../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("summary")
    .setDescription("View team time summary (Admin only)")
    .addStringOption((option) =>
      option
        .setName("period")
        .setDescription("Time period for summary")
        .setRequired(false)
        .addChoices(
          { name: "This Week", value: "week" },
          { name: "This Month", value: "month" },
          { name: "All Time", value: "all" },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName("last")
        .setDescription("Custom period: last N units of time (overrides period)")
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
    ),

  async execute(interaction) {
    // Check admin permission
    const hasPermission = await checkAdminPermission(interaction);
    if (!hasPermission) return;

    const period = interaction.options.getString("period") || "week";
    const last = interaction.options.getInteger("last");
    const unit = interaction.options.getString("unit");

    // Calculate date range; a custom last/unit window overrides the preset
    let startDate = null;
    let periodLabel;

    if (last !== null || unit !== null) {
      const amount = last ?? 1;
      const resolvedUnit = unit ?? "days";
      startDate = periodStart(amount, resolvedUnit);
      periodLabel = `Last ${amount} ${amount === 1 ? resolvedUnit.slice(0, -1) : resolvedUnit}`;
    } else if (period === "week") {
      startDate = periodStart(7, "days");
      periodLabel = "This Week";
    } else if (period === "month") {
      startDate = periodStart(1, "months");
      periodLabel = "This Month";
    } else {
      periodLabel = "All Time";
    }

    const summaryData = dbHelpers.getTeamSummary(startDate);

    if (!summaryData.entries || summaryData.entries.length === 0) {
      return interaction.reply({
        content: `No time entries found for the selected period.`,
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(`📊 Team Summary - ${periodLabel}`)
      .setTimestamp();

    // Summary by person
    if (summaryData.byPerson && Object.keys(summaryData.byPerson).length > 0) {
      let personText = "";
      const sortedPeople = Object.entries(summaryData.byPerson).sort(
        (a, b) => b[1].totalMinutes - a[1].totalMinutes,
      );

      for (const [username, data] of sortedPeople) {
        const { hours, minutes } = data;
        personText += `**${username}**: ${formatDuration(hours, minutes)}\n`;
      }

      embed.addFields({ name: "👥 By Person", value: personText });
    }

    // Summary by project
    if (
      summaryData.byProject &&
      Object.keys(summaryData.byProject).length > 0
    ) {
      let projectText = "";
      const sortedProjects = Object.entries(summaryData.byProject).sort(
        (a, b) => b[1].totalMinutes - a[1].totalMinutes,
      );

      for (const [projectName, data] of sortedProjects) {
        const { hours, minutes } = data;
        projectText += `**${projectName}**: ${formatDuration(hours, minutes)}\n`;
      }

      embed.addFields({ name: "📁 By Project", value: projectText });
    }

    // Total
    const { totalHours, totalMinutes } = summaryData.total;
    embed.addFields({
      name: "⏱️ Total Time",
      value: formatDuration(totalHours, totalMinutes),
      inline: true,
    });
    embed.addFields({
      name: "📝 Total Entries",
      value: summaryData.entries.length.toString(),
      inline: true,
    });

    await interaction.reply({ embeds: [embed], ephemeral: false });
  },
};
