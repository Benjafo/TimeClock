const { SlashCommandBuilder } = require('discord.js');
const { dbHelpers } = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clockin')
        .setDescription('Clock in to a project')
        .addStringOption(option =>
            option.setName('project')
                .setDescription('The project to clock in to')
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

        if (!dbHelpers.isUserAssignedToProject(userId, project.id)) {
            return interaction.reply({
                content: `You are not assigned to project "${projectName}". Please contact an administrator.`,
                ephemeral: true
            });
        }

        const openEntry = dbHelpers.getUserOpenEntry(userId);
        if (openEntry) {
            const openProject = dbHelpers.getTimeEntry(openEntry.id);
            return interaction.reply({
                content: `You are already clocked in to project "${openProject.project_name}". Please clock out first.`,
                ephemeral: true
            });
        }

        dbHelpers.clockIn(userId, project.id);

        await interaction.reply({
            content: `Successfully clocked in to project **${projectName}** at ${new Date().toLocaleTimeString()}.`,
            ephemeral: false
        });
    }
};
