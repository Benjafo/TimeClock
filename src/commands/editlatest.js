const { SlashCommandBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");
const { buildEditModal } = require("./edit");
const { startPicker, usesTextboxOnly } = require("../components/datetimePicker");

// Textbox users get the modal; everyone else gets the picker (as a new
// ephemeral reply — the invoking message is a slash command or a public
// clock-out message, so there is nothing ephemeral to morph).
async function openEditor(interaction, entry) {
  if (usesTextboxOnly(interaction.user.id)) {
    return interaction.showModal(buildEditModal(entry, interaction.user.id));
  }
  return startPicker(interaction, { kind: "edit", entry, via: "reply" });
}

module.exports = {
  componentPrefixes: ["editlatest_button_"],

  data: new SlashCommandBuilder()
    .setName("editlatest")
    .setDescription("Edit your most recent time entry"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    dbHelpers.getOrCreateUser(userId, username);

    const [latest] = dbHelpers.getTimeEntries(userId, null, 1);

    if (!latest) {
      return interaction.reply({
        content: "You have no time entries to edit.",
        ephemeral: true,
      });
    }

    await openEditor(interaction, latest);
  },

  // "Edit this entry" button attached to the /clockout reply
  async handleButton(interaction) {
    const ownerId = interaction.customId.split("_")[2];
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "This button belongs to someone else's entry. Use /editlatest instead.",
        ephemeral: true,
      });
    }

    const [latest] = dbHelpers.getTimeEntries(interaction.user.id, null, 1);
    if (!latest) {
      return interaction.reply({
        content: "You have no time entries to edit.",
        ephemeral: true,
      });
    }

    await openEditor(interaction, latest);
  },
};
