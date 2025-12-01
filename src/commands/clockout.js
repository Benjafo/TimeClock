const { SlashCommandBuilder } = require('discord.js');
const { dbHelpers } = require('../database/database');
const { formatDuration } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clockout')
        .setDescription('Clock out from a project')
        .addStringOption(option =>
            option.setName('project')
                .setDescription('The project to clock out from')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const projects = dbHelpers.getAllProjects();
        const filtered = projects.filter(project =>
            project.name.toLowerCase().includes(focusedValue.toLowerCase())
        ).slice(0, 25);

        await interaction.respond(
            filtered.map(project => ({ name: project.name, value: project.name }))
        );
    },

    async execute(interaction) {
        const projectName = interaction.options.getString('project');
        const userId = interaction.user.id;
        const username = interaction.user.username;

        dbHelpers.getOrCreateUser(userId, username);

        const project = dbHelpers.getProject(projectName);
        if (!project) {
            return interaction.reply({
                content: `Project "${projectName}" does not exist.`,
                ephemeral: true
            });
        }

        const openEntry = dbHelpers.getUserOpenEntryForProject(userId, project.id);
        if (!openEntry) {
            return interaction.reply({
                content: `You are not currently clocked in to project "${projectName}".`,
                ephemeral: true
            });
        }

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
