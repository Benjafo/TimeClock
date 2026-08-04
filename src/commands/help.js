const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { dbHelpers } = require("../database/database");

// Split "**/a** — desc\n..." lines into embed fields that respect the
// 1024-char field value limit.
function addLineFields(embed, name, lines) {
  let chunk = "";
  let first = true;

  for (const line of lines) {
    if (chunk.length + line.length + 1 > 1024) {
      embed.addFields({ name: first ? name : `${name} (cont.)`, value: chunk });
      first = false;
      chunk = "";
    }
    chunk += (chunk ? "\n" : "") + line;
  }

  if (chunk) {
    embed.addFields({ name: first ? name : `${name} (cont.)`, value: chunk });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List all available commands"),

  async execute(interaction) {
    const userId = interaction.user.id;
    dbHelpers.getOrCreateUser(userId, interaction.user.username);
    const isAdmin = dbHelpers.isUserAdmin(userId);

    const commands = [...interaction.client.commands.values()].sort((a, b) =>
      a.data.name.localeCompare(b.data.name),
    );

    const toLine = (command) =>
      `**/${command.data.name}** — ${command.data.description}`;

    const userLines = commands.filter((c) => !c.adminOnly).map(toLine);
    const adminLines = commands.filter((c) => c.adminOnly).map(toLine);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("📖 TimeClock Commands");

    addLineFields(embed, "Commands", userLines);
    if (isAdmin && adminLines.length > 0) {
      addLineFields(embed, "Admin Commands", adminLines);
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
