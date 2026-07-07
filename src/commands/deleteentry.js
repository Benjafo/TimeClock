const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { dbHelpers } = require("../database/database");
const { formatDate } = require("../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("deleteentry")
    .setDescription("Delete one of your time entries"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    dbHelpers.getOrCreateUser(userId, username);

    const entries = dbHelpers.getTimeEntries(userId, null, 20);

    if (entries.length === 0) {
      return interaction.reply({
        content: "You have no time entries to delete.",
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
      .setCustomId("delete_entry_select")
      .setPlaceholder("Select a time entry to delete")
      .addOptions(options.slice(0, 25));

    await interaction.reply({
      content: "Select a time entry to delete:",
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      ephemeral: true,
    });
  },

  async handleSelectMenu(interaction) {
    const entryId = parseInt(interaction.values[0]);
    const entry = dbHelpers.getTimeEntry(entryId);

    if (!entry) {
      return interaction.update({
        content: "Time entry not found.",
        components: [],
      });
    }

    if (entry.user_id !== interaction.user.id) {
      return interaction.update({
        content: "You can only delete your own time entries.",
        components: [],
      });
    }

    const confirmButton = new ButtonBuilder()
      .setCustomId(`delete_entry_confirm_${entryId}`)
      .setLabel("Delete")
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId("delete_entry_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary);

    await interaction.update({
      content:
        `Delete this entry? This cannot be undone.\n` +
        `**${entry.project_name}**\n` +
        `In: ${formatDate(entry.clock_in)}\n` +
        `Out: ${entry.clock_out ? formatDate(entry.clock_out) : "Still clocked in"}`,
      components: [
        new ActionRowBuilder().addComponents(confirmButton, cancelButton),
      ],
    });
  },

  async handleButton(interaction) {
    if (interaction.customId === "delete_entry_cancel") {
      return interaction.update({
        content: "Deletion cancelled.",
        components: [],
      });
    }

    const entryId = parseInt(interaction.customId.split("_")[3]);
    const entry = dbHelpers.getTimeEntry(entryId);

    if (!entry) {
      return interaction.update({
        content: "Time entry not found (it may already be deleted).",
        components: [],
      });
    }

    if (entry.user_id !== interaction.user.id) {
      return interaction.update({
        content: "You can only delete your own time entries.",
        components: [],
      });
    }

    dbHelpers.deleteTimeEntry(entryId);

    await interaction.update({
      content: `Deleted entry for **${entry.project_name}** (In: ${formatDate(entry.clock_in)}).`,
      components: [],
    });
  },
};
