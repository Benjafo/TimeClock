const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { dbHelpers } = require("../database/database");
const {
  formatDuration,
  parseDbDate,
  discordTimestamp,
} = require("../utils/permissions");

module.exports = {
  componentPrefixes: ["cancel_entry_"],

  data: new SlashCommandBuilder()
    .setName("cancel")
    .setDescription("Discard your current open entry without recording it"),

  async execute(interaction) {
    const userId = interaction.user.id;
    dbHelpers.getOrCreateUser(userId, interaction.user.username);

    const openEntry = dbHelpers.getUserOpenEntry(userId);
    if (!openEntry) {
      return interaction.reply({
        content: "You are not currently clocked in to any project.",
        ephemeral: true,
      });
    }

    const fullEntry = dbHelpers.getTimeEntry(openEntry.id);
    const diff = new Date() - parseDbDate(openEntry.clock_in);
    const totalMinutes = diff / (1000 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);

    const confirmButton = new ButtonBuilder()
      .setCustomId(`cancel_entry_confirm_${openEntry.id}`)
      .setLabel("Discard Entry")
      .setStyle(ButtonStyle.Danger);

    const keepButton = new ButtonBuilder()
      .setCustomId("cancel_entry_keep")
      .setLabel("Keep Working")
      .setStyle(ButtonStyle.Secondary);

    await interaction.reply({
      content:
        `Discard your open entry for **${fullEntry.project_name}**? ` +
        `This cannot be undone and no time will be recorded.\n` +
        `Clocked in ${discordTimestamp(openEntry.clock_in, "t")} (${formatDuration(hours, minutes)} ago).`,
      components: [
        new ActionRowBuilder().addComponents(confirmButton, keepButton),
      ],
      ephemeral: true,
    });
  },

  async handleButton(interaction) {
    if (interaction.customId === "cancel_entry_keep") {
      return interaction.update({
        content: "Kept your open entry — you are still clocked in.",
        components: [],
      });
    }

    const entryId = parseInt(interaction.customId.split("_")[3]);
    const entry = dbHelpers.getTimeEntry(entryId);

    if (!entry || entry.clock_out) {
      return interaction.update({
        content: "This entry is no longer open, so there is nothing to discard.",
        components: [],
      });
    }

    if (entry.user_id !== interaction.user.id) {
      return interaction.update({
        content: "You can only discard your own open entry.",
        components: [],
      });
    }

    dbHelpers.deleteTimeEntry(entryId);

    await interaction.update({
      content: `Discarded your open entry for **${entry.project_name}**. Nothing was recorded.`,
      components: [],
    });
  },
};
