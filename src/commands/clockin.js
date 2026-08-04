const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { dbHelpers } = require("../database/database");
const { discordTimestamp } = require("../utils/permissions");
const { getSetting } = require("../config/settings");

// Shared by /clockin and /clockinlast. Expects a valid project row; runs the
// assignment and already-clocked-in checks and replies.
async function performClockIn(interaction, project) {
  const userId = interaction.user.id;

  if (!dbHelpers.isUserAssignedToProject(userId, project.id)) {
    return interaction.reply({
      content: `You are not assigned to project "${project.name}". Please contact an administrator.`,
      ephemeral: true,
    });
  }

  const openEntry = dbHelpers.getUserOpenEntry(userId);
  if (openEntry) {
    const openProject = dbHelpers.getTimeEntry(openEntry.id);
    return interaction.reply({
      content: `You are already clocked in to project "${openProject.project_name}". Please clock out first.`,
      ephemeral: true,
    });
  }

  dbHelpers.clockIn(userId, project.id);

  const clockOutButton = new ButtonBuilder()
    .setCustomId(`clockout_button_${userId}`)
    .setLabel("Clock Out")
    .setStyle(ButtonStyle.Primary);

  await interaction.reply({
    content: `Successfully clocked in to project **${project.name}** at ${discordTimestamp(new Date(), "t")}.`,
    components: [new ActionRowBuilder().addComponents(clockOutButton)],
    ephemeral: false,
  });
}

module.exports = {
  performClockIn,

  data: new SlashCommandBuilder()
    .setName("clockin")
    .setDescription("Clock in to a project")
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("The project to clock in to (default: your default project)")
        .setRequired(false)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    // Only suggest projects the user can actually clock in to
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
    const userId = interaction.user.id;
    const username = interaction.user.username;

    dbHelpers.getOrCreateUser(userId, username);

    let project;
    if (projectName) {
      project = dbHelpers.getProject(projectName);
      if (!project) {
        return interaction.reply({
          content: `Project "${projectName}" does not exist.`,
          ephemeral: true,
        });
      }
    } else {
      const defaultProjectId = getSetting(userId, "defaultproject");
      if (!defaultProjectId) {
        return interaction.reply({
          content:
            "No project given and no default project set. " +
            "Pass a project or set one with /setdefaultproject.",
          ephemeral: true,
        });
      }

      project = dbHelpers.getProjectById(Number(defaultProjectId));
      if (!project) {
        return interaction.reply({
          content:
            "Your default project no longer exists. " +
            "Set a new one with /setdefaultproject.",
          ephemeral: true,
        });
      }
    }

    await performClockIn(interaction, project);
  },
};
