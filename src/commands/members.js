const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const { checkAdminPermission } = require("../utils/permissions");

module.exports = {
  adminOnly: true,

  data: new SlashCommandBuilder()
    .setName("members")
    .setDescription("See project assignments (Admin only)")
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("List the users assigned to this project")
        .setRequired(false)
        .setAutocomplete(true),
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("List the projects this user is assigned to")
        .setRequired(false),
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

    const projectName = interaction.options.getString("project");
    const targetUser = interaction.options.getUser("user");

    if (!projectName && !targetUser) {
      return interaction.reply({
        content: "Provide a `project`, a `user`, or both.",
        ephemeral: true,
      });
    }

    let project = null;
    if (projectName) {
      project = dbHelpers.getProject(projectName);
      if (!project) {
        return interaction.reply({
          content: `Project "${projectName}" does not exist.`,
          ephemeral: true,
        });
      }
    }

    // Both given: answer the membership question directly.
    if (project && targetUser) {
      const assigned = dbHelpers.isUserAssignedToProject(
        targetUser.id,
        project.id,
      );
      return interaction.reply({
        content: assigned
          ? `<@${targetUser.id}> **is** assigned to **${project.name}**.`
          : `<@${targetUser.id}> is **not** assigned to **${project.name}**.`,
        ephemeral: true,
      });
    }

    if (project) {
      const members = dbHelpers.getProjectMembers(project.id);
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`👥 Members of ${project.name}`)
        .setDescription(
          members.length > 0
            ? members.map((m) => `• <@${m.discord_id}> (${m.username})`).join("\n")
            : "No one is assigned to this project.",
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const projects = dbHelpers.getUserProjects(targetUser.id);
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`📁 Projects for ${targetUser.username}`)
      .setDescription(
        projects.length > 0
          ? projects.map((p) => `• ${p.name}`).join("\n")
          : "This user is not assigned to any projects.",
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
