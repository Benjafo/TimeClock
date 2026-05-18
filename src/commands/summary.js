const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  checkAdminPermission,
  formatDuration,
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
    ),

  async execute(interaction) {
    // Check admin permission
    const hasPermission = await checkAdminPermission(interaction);
    if (!hasPermission) return;

    const period = interaction.options.getString("period") || "week";

    // Calculate date range
    let startDate = null;
    const now = new Date();

    if (period === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === "month") {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    }

    const summaryData = dbHelpers.getTeamSummary(startDate);

    if (!summaryData.entries || summaryData.entries.length === 0) {
      return interaction.reply({
        content: `No time entries found for the selected period.`,
        ephemeral: true,
      });
    }

    const periodLabel =
      period === "week"
        ? "This Week"
        : period === "month"
          ? "This Month"
          : "All Time";

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
