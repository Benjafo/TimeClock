const { SlashCommandBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const { buildEditModal } = require("./edit");

module.exports = {
  componentPrefixes: ["editlatest_button_"],

  data: new SlashCommandBuilder()
    .setName("editlatest")
    .setDescription("Edit your most recent time entry"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    dbHelpers.getOrCreateUser(userId, username);

    const [latest] = dbHelpers.getTimeEntries(userId, null, 1);

    if (!latest) {
      return interaction.reply({
        content: "You have no time entries to edit.",
        ephemeral: true,
      });
    }

    await interaction.showModal(buildEditModal(latest, interaction.user.id));
  },

  // "Edit this entry" button attached to the /clockout reply
  async handleButton(interaction) {
    const ownerId = interaction.customId.split("_")[2];
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "This button belongs to someone else's entry. Use /editlatest instead.",
        ephemeral: true,
      });
    }

    const [latest] = dbHelpers.getTimeEntries(interaction.user.id, null, 1);
    if (!latest) {
      return interaction.reply({
        content: "You have no time entries to edit.",
        ephemeral: true,
      });
    }

    await interaction.showModal(buildEditModal(latest, interaction.user.id));
  },
};
