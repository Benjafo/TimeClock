const { SlashCommandBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  checkAdminPermission,
  formatDuration,
  parseDbDate,
  discordTimestamp,
} = require("../utils/permissions");

module.exports = {
  adminOnly: true,

  data: new SlashCommandBuilder()
    .setName("forceclockout")
    .setDescription("Clock out another user (Admin only)")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to clock out")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("note")
        .setDescription("Optional note to attach to the entry")
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!(await checkAdminPermission(interaction))) return;

    const targetUser = interaction.options.getUser("user");
    const note = interaction.options.getString("note");

    const openEntry = dbHelpers.getUserOpenEntry(targetUser.id);
    if (!openEntry) {
      return interaction.reply({
        content: `<@${targetUser.id}> is not currently clocked in.`,
        ephemeral: true,
      });
    }

    const fullEntry = dbHelpers.getTimeEntry(openEntry.id);
    dbHelpers.clockOut(openEntry.id, note);

    const diff = new Date() - parseDbDate(openEntry.clock_in);
    const totalMinutes = diff / (1000 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);

    await interaction.reply({
      content:
        `Clocked out <@${targetUser.id}> from **${fullEntry.project_name}** ` +
        `(clocked in ${discordTimestamp(openEntry.clock_in, "R")}, worked ${formatDuration(hours, minutes)}).` +
        (note ? `\n📝 ${note}` : ""),
      ephemeral: false,
    });
  },
};
