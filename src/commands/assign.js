const { SlashCommandBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const { checkAdminPermission } = require("../utils/permissions");

module.exports = {
  adminOnly: true,

  data: new SlashCommandBuilder()
    .setName("assign")
    .setDescription("Assign a user to a project (Admin only)")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to assign")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("The project to assign them to")
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const projects = dbHelpers.getAllProjects();
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
    if (!(await checkAdminPermission(interaction))) return;

    const targetUser = interaction.options.getUser("user");
    const projectName = interaction.options.getString("project");

    const project = dbHelpers.getProject(projectName);
    if (!project) {
      return interaction.reply({
        content: `Project "${projectName}" does not exist.`,
        ephemeral: true,
      });
    }

    dbHelpers.getOrCreateUser(targetUser.id, targetUser.username);

    if (dbHelpers.isUserAssignedToProject(targetUser.id, project.id)) {
      return interaction.reply({
        content: `<@${targetUser.id}> is already assigned to **${projectName}**.`,
        ephemeral: true,
      });
    }

    dbHelpers.assignUserToProject(targetUser.id, project.id);

    await interaction.reply({
      content: `✅ Assigned <@${targetUser.id}> to project **${projectName}**.`,
      ephemeral: false,
    });
  },
};
