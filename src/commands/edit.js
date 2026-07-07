const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  formatDate,
  formatDateForInput,
  localToUTC,
  discordTimestamp,
} = require("../utils/permissions");

function buildEditModal(entry) {
  const modal = new ModalBuilder()
    .setCustomId(`edit_entry_modal_${entry.id}`)
    .setTitle(`Edit Time Entry - ${entry.project_name}`.substring(0, 45));

  const clockInInput = new TextInputBuilder()
    .setCustomId("clock_in")
    .setLabel("Clock In Time (YYYY-MM-DD HH:MM:SS)")
    .setStyle(TextInputStyle.Short)
    .setValue(formatDateForInput(entry.clock_in))
    .setRequired(true);

  const clockOutInput = new TextInputBuilder()
    .setCustomId("clock_out")
    .setLabel("Clock Out Time (YYYY-MM-DD HH:MM:SS)")
    .setStyle(TextInputStyle.Short)
    .setValue(entry.clock_out ? formatDateForInput(entry.clock_out) : "")
    .setRequired(false);

  const notesInput = new TextInputBuilder()
    .setCustomId("notes")
    .setLabel("Notes (optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(entry.notes || "")
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(clockInInput),
    new ActionRowBuilder().addComponents(clockOutInput),
    new ActionRowBuilder().addComponents(notesInput),
  );

  return modal;
}

module.exports = {
  buildEditModal,

  data: new SlashCommandBuilder()
    .setName("edit")
    .setDescription("Edit your time entries"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    dbHelpers.getOrCreateUser(userId, username);

    const entries = dbHelpers.getTimeEntries(userId, null, 20);

    if (entries.length === 0) {
      return interaction.reply({
        content: "You have no time entries to edit.",
        ephemeral: true,
      });
    }

    const options = entries.map((entry) => {
      const status = entry.clock_out ? "✅" : "⏱️";
      const label = `${status} ${entry.project_name} - ${formatDate(entry.clock_in)}`;
      const description = entry.clock_out
        ? `Out: ${formatDate(entry.clock_out)}`
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
      content: "Select a time entry to edit:",
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

    if (entry.user_id !== interaction.user.id) {
      return interaction.reply({
        content: "You can only edit your own time entries.",
        ephemeral: true,
      });
    }

    await interaction.showModal(buildEditModal(entry));
  },

  async handleModalSubmit(interaction) {
    const entryId = parseInt(interaction.customId.split("_")[3]);
    const clockIn = interaction.fields.getTextInputValue("clock_in");
    const clockOut = interaction.fields.getTextInputValue("clock_out") || null;
    const notes = interaction.fields.getTextInputValue("notes") || null;

    const entry = dbHelpers.getTimeEntry(entryId);
    if (entry.user_id !== interaction.user.id) {
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

      const clockInUTC = localToUTC(clockIn);
      const clockOutUTC = clockOut ? localToUTC(clockOut) : null;

      dbHelpers.updateTimeEntry(entryId, clockInUTC, clockOutUTC, notes);

      await interaction.reply({
        content:
          `Time entry updated successfully!\n` +
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
