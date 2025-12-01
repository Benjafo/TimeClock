const { SlashCommandBuilder } = require('discord.js');
const { dbHelpers } = require('../database/database');
const { formatDuration } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clockout')
        .setDescription('Clock out from your current project'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        dbHelpers.getOrCreateUser(userId, username);

        const openEntry = dbHelpers.getUserOpenEntry(userId);
        if (!openEntry) {
            return interaction.reply({
                content: `You are not currently clocked in to any project.`,
                ephemeral: true
            });
        }

        // Get the full entry with project name
        const fullEntry = dbHelpers.getTimeEntry(openEntry.id);
        const projectName = fullEntry.project_name;

        dbHelpers.clockOut(openEntry.id);

        const clockInTime = new Date(openEntry.clock_in);
        const clockOutTime = new Date();
        const diff = clockOutTime - clockInTime;
        const totalMinutes = diff / (1000 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);

        await interaction.reply({
            content: `Successfully clocked out from project **${projectName}** at ${clockOutTime.toLocaleTimeString()}.\n` +
                    `Time worked: ${formatDuration(hours, minutes)}`,
            ephemeral: false
        });
    }
};
