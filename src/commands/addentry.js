const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  formatDateForInput,
  localToUTC,
  discordTimestamp,
  formatDuration,
  parseDbDate,
} = require("../utils/permissions");

module.exports = {
  componentPrefixes: ["add_entry_"],

  data: new SlashCommandBuilder()
    .setName("addentry")
    .setDescription("Add a past time entry you forgot to clock")
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("The project the entry is for")
        .setRequired(true)
        .setAutocomplete(true),
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

    const now = formatDateForInput(new Date(), userId);

    const modal = new ModalBuilder()
      .setCustomId(`add_entry_modal_${project.id}`)
      .setTitle(`Add Time Entry - ${project.name}`.substring(0, 45));

    const clockInInput = new TextInputBuilder()
      .setCustomId("clock_in")
      .setLabel("Clock In Time (YYYY-MM-DD HH:MM:SS)")
      .setStyle(TextInputStyle.Short)
      .setValue(now)
      .setRequired(true);

    const clockOutInput = new TextInputBuilder()
      .setCustomId("clock_out")
      .setLabel("Clock Out Time (YYYY-MM-DD HH:MM:SS)")
      .setStyle(TextInputStyle.Short)
      .setValue(now)
      .setRequired(true);

    const notesInput = new TextInputBuilder()
      .setCustomId("notes")
      .setLabel("Notes (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(clockInInput),
      new ActionRowBuilder().addComponents(clockOutInput),
      new ActionRowBuilder().addComponents(notesInput),
    );

    await interaction.showModal(modal);
  },

  async handleModalSubmit(interaction) {
    const userId = interaction.user.id;
    const projectId = parseInt(interaction.customId.split("_")[3]);

    const project = dbHelpers.getProjectById(projectId);
    if (!project) {
      return interaction.reply({
        content: "Project not found (it may have been deleted).",
        ephemeral: true,
      });
    }

    if (!dbHelpers.isUserAssignedToProject(userId, projectId)) {
      return interaction.reply({
        content: `You are not assigned to project "${project.name}".`,
        ephemeral: true,
      });
    }

    const clockIn = interaction.fields.getTextInputValue("clock_in");
    const clockOut = interaction.fields.getTextInputValue("clock_out");
    const notes = interaction.fields.getTextInputValue("notes") || null;

    const clockInDate = new Date(clockIn);
    const clockOutDate = new Date(clockOut);

    if (isNaN(clockInDate.getTime())) {
      return interaction.reply({
        content: "Invalid clock in time format. Please use YYYY-MM-DD HH:MM:SS",
        ephemeral: true,
      });
    }

    if (isNaN(clockOutDate.getTime())) {
      return interaction.reply({
        content: "Invalid clock out time format. Please use YYYY-MM-DD HH:MM:SS",
        ephemeral: true,
      });
    }

    if (clockOutDate <= clockInDate) {
      return interaction.reply({
        content: "Clock out time must be after clock in time.",
        ephemeral: true,
      });
    }

    const clockInUTC = localToUTC(clockIn, userId);
    const clockOutUTC = localToUTC(clockOut, userId);

    dbHelpers.createTimeEntry(userId, projectId, clockInUTC, clockOutUTC, notes);

    const diff = parseDbDate(clockOutUTC) - parseDbDate(clockInUTC);
    const totalMinutes = diff / (1000 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);

    await interaction.reply({
      content:
        `Added a time entry for **${project.name}**.\n` +
        `In: ${discordTimestamp(clockInUTC)}\n` +
        `Out: ${discordTimestamp(clockOutUTC)}\n` +
        `Time worked: ${formatDuration(hours, minutes)}` +
        (notes ? `\n📝 ${notes}` : ""),
      ephemeral: false,
    });
  },
};
