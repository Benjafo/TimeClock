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
  componentPrefixes: ["delete_entry_"],

  data: new SlashCommandBuilder()
    .setName("deleteentry")
    .setDescription("Delete one of your time entries")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Delete another user's entry (Admin only)")
        .setRequired(false),
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    dbHelpers.getOrCreateUser(userId, username);

    // Admins may delete someone else's entries.
    const targetUser = interaction.options.getUser("user");
    if (
      targetUser &&
      targetUser.id !== userId &&
      !dbHelpers.isUserAdmin(userId)
    ) {
      return interaction.reply({
        content: "Only administrators can delete another user's entries.",
        ephemeral: true,
      });
    }
    const subjectId = targetUser ? targetUser.id : userId;
    const isSelf = subjectId === userId;

    const entries = dbHelpers.getTimeEntries(subjectId, null, 20);

    if (entries.length === 0) {
      return interaction.reply({
        content: isSelf
          ? "You have no time entries to delete."
          : `<@${subjectId}> has no time entries to delete.`,
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
      .setCustomId("delete_entry_select")
      .setPlaceholder("Select a time entry to delete")
      .addOptions(options.slice(0, 25));

    await interaction.reply({
      content: isSelf
        ? "Select a time entry to delete:"
        : `Select one of <@${subjectId}>'s time entries to delete:`,
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

    if (
      entry.user_id !== interaction.user.id &&
      !dbHelpers.isUserAdmin(interaction.user.id)
    ) {
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
        `In: ${formatDate(entry.clock_in, interaction.user.id)}\n` +
        `Out: ${entry.clock_out ? formatDate(entry.clock_out, interaction.user.id) : "Still clocked in"}`,
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

    if (
      entry.user_id !== interaction.user.id &&
      !dbHelpers.isUserAdmin(interaction.user.id)
    ) {
      return interaction.update({
        content: "You can only delete your own time entries.",
        components: [],
      });
    }

    dbHelpers.deleteTimeEntry(entryId);

    const whose =
      entry.user_id === interaction.user.id ? "" : ` (owned by <@${entry.user_id}>)`;

    await interaction.update({
      content: `Deleted entry for **${entry.project_name}**${whose} (In: ${formatDate(entry.clock_in, interaction.user.id)}).`,
      components: [],
    });
  },
};
