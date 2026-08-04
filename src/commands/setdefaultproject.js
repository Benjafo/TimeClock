const { SlashCommandBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const { getSetting, setSetting } = require("../config/settings");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setdefaultproject")
    .setDescription("Set the project /clockin uses when none is given")
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("The project to use as your default")
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("clear")
        .setDescription("Clear your default project")
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
    const userId = interaction.user.id;
    dbHelpers.getOrCreateUser(userId, interaction.user.username);

    const projectName = interaction.options.getString("project");
    const clear = interaction.options.getBoolean("clear");

    if (clear) {
      setSetting(userId, "defaultproject", null);
      return interaction.reply({
        content: "Your default project has been cleared.",
        ephemeral: true,
      });
    }

    if (!projectName) {
      const currentId = getSetting(userId, "defaultproject");
      const current = currentId
        ? dbHelpers.getProjectById(Number(currentId))
        : null;
      return interaction.reply({
        content: current
          ? `Your default project is **${current.name}**. Pass \`project\` to change it or \`clear:true\` to unset it.`
          : "You have no default project. Pass `project` to set one.",
        ephemeral: true,
      });
    }

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

    setSetting(userId, "defaultproject", project.id);

    await interaction.reply({
      content: `Default project set to **${project.name}**. /clockin with no project will use it.`,
      ephemeral: true,
    });
  },
};
