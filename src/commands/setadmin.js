const { SlashCommandBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const { checkAdminPermission } = require("../utils/permissions");

module.exports = {
  adminOnly: true,

  data: new SlashCommandBuilder()
    .setName("setadmin")
    .setDescription("Grant a user administrator access (Admin only)")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to make an administrator")
        .setRequired(true),
    ),

  async execute(interaction) {
    if (!(await checkAdminPermission(interaction))) return;

    const targetUser = interaction.options.getUser("user");

    if (targetUser.bot) {
      return interaction.reply({
        content: "Bots cannot be administrators.",
        ephemeral: true,
      });
    }

    dbHelpers.getOrCreateUser(targetUser.id, targetUser.username);

    if (dbHelpers.isUserAdmin(targetUser.id)) {
      return interaction.reply({
        content: `<@${targetUser.id}> is already an administrator.`,
        ephemeral: true,
      });
    }

    dbHelpers.setUserAdmin(targetUser.id, true);

    await interaction.reply({
      content: `<@${targetUser.id}> is now an administrator.`,
      ephemeral: false,
    });
  },
};
