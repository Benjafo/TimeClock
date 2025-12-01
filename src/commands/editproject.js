const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { dbHelpers } = require('../database/database');
const { checkAdminPermission } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('editproject')
        .setDescription('Edit a project name (Admin only)'),

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
            .setCustomId('edit_project_select')
            .setPlaceholder('Select a project to edit')
            .addOptions(options.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: 'Select a project to edit:',
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

        const modal = new ModalBuilder()
            .setCustomId(`edit_project_modal_${projectId}`)
            .setTitle('Edit Project');

        const nameInput = new TextInputBuilder()
            .setCustomId('project_name')
            .setLabel('New Project Name')
            .setStyle(TextInputStyle.Short)
            .setValue(project.name)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(nameInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    },

    async handleModalSubmit(interaction) {
        const projectId = parseInt(interaction.customId.split('_')[3]);
        const newName = interaction.fields.getTextInputValue('project_name');

        const projects = dbHelpers.getAllProjects();
        const project = projects.find(p => p.id === projectId);

        if (!project) {
            return interaction.reply({
                content: 'Project not found.',
                ephemeral: true
            });
        }

        const existingProject = dbHelpers.getProject(newName);
        if (existingProject && existingProject.id !== projectId) {
            return interaction.reply({
                content: `A project named "${newName}" already exists.`,
                ephemeral: true
            });
        }

        try {
            dbHelpers.updateProjectName(project.name, newName);

            await interaction.reply({
                content: `Project renamed from **${project.name}** to **${newName}**.`,
                ephemeral: false
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: 'An error occurred while updating the project.',
                ephemeral: true
            });
        }
    }
};
