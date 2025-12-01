const { SlashCommandBuilder } = require('discord.js');
const { dbHelpers } = require('../database/database');
const { checkAdminPermission } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createproject')
        .setDescription('Create a new project (Admin only)')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the project')
                .setRequired(true)),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        dbHelpers.getOrCreateUser(userId, username);

        if (!await checkAdminPermission(interaction)) {
            return;
        }

        const projectName = interaction.options.getString('name');

        const existingProject = dbHelpers.getProject(projectName);
        if (existingProject) {
            return interaction.reply({
                content: `Project "${projectName}" already exists.`,
                ephemeral: true
            });
        }

        try {
            dbHelpers.createProject(projectName, userId);

            await interaction.reply({
                content: `Project **${projectName}** has been created successfully! You have been automatically assigned to this project.`,
                ephemeral: false
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: 'An error occurred while creating the project.',
                ephemeral: true
            });
        }
    }
};
