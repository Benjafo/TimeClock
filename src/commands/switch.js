const { SlashCommandBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  formatDuration,
  parseDbDate,
  discordTimestamp,
} = require("../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("switch")
    .setDescription("Clock out of your current project and into another")
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("The project to switch to")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName("note")
        .setDescription("Optional note for the entry you are closing")
        .setRequired(false),
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const projects = dbHelpers.getUserProjects(interaction.user.id);
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
    const note = interaction.options.getString("note");
    const userId = interaction.user.id;
    const username = interaction.user.username;

    dbHelpers.getOrCreateUser(userId, username);

    const project = dbHelpers.getProject(projectName);
    if (!project) {
      return interaction.reply({
        content: `Project "${projectName}" does not exist.`,
        ephemeral: true,
      });
    }

    if (!dbHelpers.isUserAssignedToProject(userId, project.id)) {
      return interaction.reply({
        content: `You are not assigned to project "${projectName}". Please contact an administrator.`,
        ephemeral: true,
      });
    }

    const openEntry = dbHelpers.getUserOpenEntry(userId);
    if (!openEntry) {
      return interaction.reply({
        content: "You are not clocked in to anything. Use /clockin instead.",
        ephemeral: true,
      });
    }

    const previousEntry = dbHelpers.getTimeEntry(openEntry.id);
    if (previousEntry.project_id === project.id) {
      return interaction.reply({
        content: `You are already clocked in to **${projectName}**.`,
        ephemeral: true,
      });
    }

    dbHelpers.clockOut(openEntry.id, note);
    dbHelpers.clockIn(userId, project.id);

    const diff = new Date() - parseDbDate(openEntry.clock_in);
    const totalMinutes = diff / (1000 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);

    await interaction.reply({
      content:
        `Switched projects at ${discordTimestamp(new Date(), "t")}.\n` +
        `⏹️ **${previousEntry.project_name}**: ${formatDuration(hours, minutes)}` +
        (note ? ` — 📝 ${note}` : "") +
        `\n▶️ **${projectName}**: clocked in.`,
      ephemeral: false,
    });
  },
};
