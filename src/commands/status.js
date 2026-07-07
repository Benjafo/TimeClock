const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const { formatDuration, parseDbDate } = require("../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("See who is currently clocked in"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const isAdmin = dbHelpers.isUserAdmin(userId);

    dbHelpers.getOrCreateUser(userId, username);

    // Get all open entries
    const allEntries = dbHelpers.getAllOpenEntries();

    if (allEntries.length === 0) {
      return interaction.reply({
        content: "No one is currently clocked in.",
        ephemeral: true,
      });
    }

    // If not admin, filter to only show current user
    const entries = isAdmin
      ? allEntries
      : allEntries.filter((e) => e.discord_id === userId);

    if (entries.length === 0) {
      return interaction.reply({
        content: "You are not currently clocked in.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("⏱️ Current Status")
      .setDescription(
        isAdmin ? "Team members currently clocked in" : "Your current status",
      )
      .setTimestamp();

    let statusText = "";

    for (const entry of entries) {
      const clockInTime = parseDbDate(entry.clock_in);
      const now = new Date();
      const diff = now - clockInTime;
      const totalMinutes = diff / (1000 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.floor(totalMinutes % 60);

      const duration = formatDuration(hours, minutes);
      const displayName = entry.username || "Unknown User";

      statusText += `**${displayName}** - ${entry.project_name}\n`;
      statusText += `⏱️ ${duration}\n\n`;
    }

    embed.addFields({
      name: "Currently Working",
      value: statusText || "No one is clocked in",
    });

    await interaction.reply({ embeds: [embed], ephemeral: !isAdmin });
  },
};
