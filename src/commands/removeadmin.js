const { SlashCommandBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const { checkAdminPermission } = require("../utils/permissions");

module.exports = {
  adminOnly: true,

  data: new SlashCommandBuilder()
    .setName("removeadmin")
    .setDescription("Revoke a user's administrator access (Admin only)")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to remove administrator access from")
        .setRequired(true),
    ),

  async execute(interaction) {
    if (!(await checkAdminPermission(interaction))) return;

    const targetUser = interaction.options.getUser("user");

    if (!dbHelpers.isUserAdmin(targetUser.id)) {
      return interaction.reply({
        content: `<@${targetUser.id}> is not an administrator.`,
        ephemeral: true,
      });
    }

    if (dbHelpers.countAdmins() <= 1) {
      return interaction.reply({
        content:
          "Cannot remove the last administrator. Grant another user admin access with /setadmin first.",
        ephemeral: true,
      });
    }

    dbHelpers.setUserAdmin(targetUser.id, false);

    await interaction.reply({
      content: `<@${targetUser.id}> is no longer an administrator.`,
      ephemeral: false,
    });
  },
};
