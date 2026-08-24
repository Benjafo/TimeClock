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

async function performClockOut(interaction, note) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  dbHelpers.getOrCreateUser(userId, username);

  const openEntry = dbHelpers.getUserOpenEntry(userId);
  if (!openEntry) {
    return interaction.reply({
      content: `You are not currently clocked in to any project.`,
      ephemeral: true,
    });
  }

  const fullEntry = dbHelpers.getTimeEntry(openEntry.id);
  const projectName = fullEntry.project_name;

  dbHelpers.clockOut(openEntry.id, note);

  const clockInTime = parseDbDate(openEntry.clock_in);
  const clockOutTime = new Date();
  const diff = clockOutTime - clockInTime;
  const totalMinutes = diff / (1000 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);

  const editButton = new ButtonBuilder()
    .setCustomId(`editlatest_button_${userId}`)
    .setLabel("Edit this entry")
    .setStyle(ButtonStyle.Secondary);

  await interaction.reply({
    content:
      `Successfully clocked out from project **${projectName}** at ${discordTimestamp(clockOutTime, "t")}.\n` +
      `Time worked: ${formatDuration(hours, minutes)}` +
      (note ? `\n📝 ${note}` : ""),
    components: [new ActionRowBuilder().addComponents(editButton)],
    ephemeral: false,
  });
}

module.exports = {
  performClockOut,
  componentPrefixes: ["clockout_button_"],

  data: new SlashCommandBuilder()
    .setName("clockout")
    .setDescription("Clock out from your current project")
    .addStringOption((option) =>
      option
        .setName("note")
        .setDescription("What did you work on? (optional)")
        .setRequired(false),
    ),

  async execute(interaction) {
    const note = interaction.options.getString("note");
    await performClockOut(interaction, note);
  },

  // "Clock Out" button attached to the /clockin reply
  async handleButton(interaction) {
    const ownerId = interaction.customId.split("_")[2];
    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        content: "This button belongs to someone else's clock-in. Use /clockout instead.",
        ephemeral: true,
      });
    }
    await performClockOut(interaction, null);
  },
};
