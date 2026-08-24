const { SlashCommandBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const { performClockIn } = require("./clockin");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clockinlast")
    .setDescription("Clock in to the project you last worked on"),

  async execute(interaction) {
    const userId = interaction.user.id;
    dbHelpers.getOrCreateUser(userId, interaction.user.username);

    const [latest] = dbHelpers.getTimeEntries(userId, null, 1);
    if (!latest) {
      return interaction.reply({
        content: "You have no previous time entries. Use /clockin instead.",
        ephemeral: true,
      });
    }

    const project = dbHelpers.getProjectById(latest.project_id);
    if (!project) {
      return interaction.reply({
        content: `Your last project no longer exists. Use /clockin instead.`,
        ephemeral: true,
      });
    }

    await performClockIn(interaction, project);
  },
};
