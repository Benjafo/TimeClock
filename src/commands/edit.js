const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
} = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  formatDate,
  formatDateForInput,
  localToUTC,
  discordTimestamp,
} = require("../utils/permissions");
const { startPicker, usesTextboxOnly } = require("../components/datetimePicker");

// Textbox fallback for users with datepicker+timepicker set to "textbox".
// userId is the viewer/editor: dates are shown and parsed in their timezone.
function buildEditModal(entry, userId) {
  const modal = new ModalBuilder()
    .setCustomId(`edit_entry_modal_${entry.id}`)
    .setTitle(`Edit Time Entry - ${entry.project_name}`.substring(0, 45));

  const clockInInput = new TextInputBuilder()
    .setCustomId("clock_in")
    .setStyle(TextInputStyle.Short)
    .setValue(formatDateForInput(entry.clock_in, userId))
    .setRequired(true);

  const clockOutInput = new TextInputBuilder()
    .setCustomId("clock_out")
    .setStyle(TextInputStyle.Short)
    .setValue(entry.clock_out ? formatDateForInput(entry.clock_out, userId) : "")
    .setRequired(false);

  const notesInput = new TextInputBuilder()
    .setCustomId("notes")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(entry.notes || "")
    .setRequired(false);

  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel("Clock In Time")
      .setDescription("Format: YYYY-MM-DD HH:MM:SS")
      .setTextInputComponent(clockInInput),
    new LabelBuilder()
      .setLabel("Clock Out Time")
      .setDescription("YYYY-MM-DD HH:MM:SS, or empty if still clocked in")
      .setTextInputComponent(clockOutInput),
    new LabelBuilder()
      .setLabel("Notes")
      .setDescription("Optional")
      .setTextInputComponent(notesInput),
  );

  return modal;
}

module.exports = {
  buildEditModal,
  componentPrefixes: ["edit_entry_"],

  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit your time entries")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Edit another user's entries (Admin only)")
        .setRequired(false),
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    dbHelpers.getOrCreateUser(userId, username);

    // Admins may edit someone else's entries.
    const targetUser = interaction.options.getUser("user");
    if (
      targetUser &&
      targetUser.id !== userId &&
      !dbHelpers.isUserAdmin(userId)
    ) {
      return interaction.reply({
        content: "Only administrators can edit another user's entries.",
        ephemeral: true,
      });
    }
    const subjectId = targetUser ? targetUser.id : userId;
    const isSelf = subjectId === userId;

    const entries = dbHelpers.getTimeEntries(subjectId, null, 20);

    if (entries.length === 0) {
      return interaction.reply({
        content: isSelf
          ? "You have no time entries to edit."
          : `<@${subjectId}> has no time entries to edit.`,
        ephemeral: true,
      });
    }

    const options = entries.map((entry) => {
      const status = entry.clock_out ? "✅" : "⏱️";
      const label = `${status} ${entry.project_name} - ${formatDate(entry.clock_in, userId)}`;
      const description = entry.clock_out
        ? `Out: ${formatDate(entry.clock_out, userId)}`
        : "Still clocked in";

      return {
        label: label.substring(0, 100),
        description: description.substring(0, 100),
        value: entry.id.toString(),
      };
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("edit_entry_select")
      .setPlaceholder("Select a time entry to edit")
      .addOptions(options.slice(0, 25));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
      content: isSelf
        ? "Select a time entry to edit:"
        : `Select one of <@${subjectId}>'s time entries to edit:`,
      components: [row],
      ephemeral: true,
    });
  },

  async handleSelectMenu(interaction) {
    const entryId = parseInt(interaction.values[0]);
    const entry = dbHelpers.getTimeEntry(entryId);

    if (!entry) {
      return interaction.reply({
        content: "Time entry not found.",
        ephemeral: true,
      });
    }

    if (
      entry.user_id !== interaction.user.id &&
      !dbHelpers.isUserAdmin(interaction.user.id)
    ) {
      return interaction.reply({
        content: "You can only edit your own time entries.",
        ephemeral: true,
      });
    }

    if (usesTextboxOnly(interaction.user.id)) {
      return interaction.showModal(buildEditModal(entry, interaction.user.id));
    }
    await startPicker(interaction, { kind: "edit", entry, via: "update" });
  },

  async handleModalSubmit(interaction) {
    const entryId = parseInt(interaction.customId.split("_")[3]);
    const clockIn = interaction.fields.getTextInputValue("clock_in");
    const clockOut = interaction.fields.getTextInputValue("clock_out") || null;
    const notes = interaction.fields.getTextInputValue("notes") || null;

    const entry = dbHelpers.getTimeEntry(entryId);
    if (!entry) {
      return interaction.reply({
        content: "Time entry not found (it may have been deleted).",
        ephemeral: true,
      });
    }

    if (
      entry.user_id !== interaction.user.id &&
      !dbHelpers.isUserAdmin(interaction.user.id)
    ) {
      return interaction.reply({
        content: "You can only edit your own time entries.",
        ephemeral: true,
      });
    }

    try {
      const clockInDate = new Date(clockIn);
      const clockOutDate = clockOut ? new Date(clockOut) : null;

      if (isNaN(clockInDate.getTime())) {
        return interaction.reply({
          content:
            "Invalid clock in time format. Please use YYYY-MM-DD HH:MM:SS",
          ephemeral: true,
        });
      }

      if (clockOut && isNaN(clockOutDate.getTime())) {
        return interaction.reply({
          content:
            "Invalid clock out time format. Please use YYYY-MM-DD HH:MM:SS",
          ephemeral: true,
        });
      }

      if (clockOutDate && clockOutDate <= clockInDate) {
        return interaction.reply({
          content: "Clock out time must be after clock in time.",
          ephemeral: true,
        });
      }

      const clockInUTC = localToUTC(clockIn, interaction.user.id);
      const clockOutUTC = clockOut
        ? localToUTC(clockOut, interaction.user.id)
        : null;

      dbHelpers.updateTimeEntry(entryId, clockInUTC, clockOutUTC, notes);

      const whose =
        entry.user_id === interaction.user.id ? "" : ` (for <@${entry.user_id}>)`;

      await interaction.reply({
        content:
          `Time entry updated successfully!${whose}\n` +
          `**${entry.project_name}**\n` +
          `In: ${discordTimestamp(clockInUTC)}\n` +
          `Out: ${clockOutUTC ? discordTimestamp(clockOutUTC) : "Not clocked out"}` +
          (notes ? `\n📝 ${notes}` : ""),
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "An error occurred while updating the time entry.",
        ephemeral: true,
      });
    }
  },
};
