const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { dbHelpers } = require('../database/database');
const { checkAdminPermission } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deleteproject')
        .setDescription('Delete a project (Admin only)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        dbHelpers.getOrCreateUser(userId, username);

        if (!await checkAdminPermission(interaction)) {
            return;
        }

        const projects = dbHelpers.getAllProjects();

        if (projects.length === 0) {
            return interaction.reply({
                content: 'No projects exist yet.',
                ephemeral: true
            });
        }

        const options = projects.map(project => ({
            label: project.name,
            description: `Created ${new Date(project.created_at).toLocaleDateString()}`,
            value: project.id.toString()
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('delete_project_select')
            .setPlaceholder('Select a project to delete')
            .addOptions(options.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: '⚠️ Select a project to delete. This will also delete all associated time entries!',
            components: [row],
            ephemeral: true
        });
    },

    async handleSelectMenu(interaction) {
        const projectId = parseInt(interaction.values[0]);
        const projects = dbHelpers.getAllProjects();
        const project = projects.find(p => p.id === projectId);

        if (!project) {
            return interaction.reply({
                content: 'Project not found.',
                ephemeral: true
            });
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(`delete_project_confirm_${projectId}`)
            .setLabel('Confirm Delete')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('delete_project_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.update({
            content: `⚠️ Are you sure you want to delete project **${project.name}**?\n\nThis will permanently delete all time entries associated with this project!`,
            components: [row]
        });
    },

    async handleButton(interaction) {
        if (interaction.customId === 'delete_project_cancel') {
            return interaction.update({
                content: 'Project deletion cancelled.',
                components: []
            });
        }

        const projectId = parseInt(interaction.customId.split('_')[3]);
        const projects = dbHelpers.getAllProjects();
        const project = projects.find(p => p.id === projectId);

        if (!project) {
            return interaction.update({
                content: 'Project not found.',
                components: []
            });
        }

        try {
            dbHelpers.deleteProject(projectId);

            await interaction.update({
                content: `Project **${project.name}** has been deleted successfully.`,
                components: []
            });
        } catch (error) {
            console.error(error);
            await interaction.update({
                content: 'An error occurred while deleting the project.',
                components: []
            });
        }
    }
};
