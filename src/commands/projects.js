const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { dbHelpers } = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('projects')
        .setDescription('List all available projects'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        dbHelpers.getOrCreateUser(userId, username);

        const allProjects = dbHelpers.getAllProjects();

        if (allProjects.length === 0) {
            return interaction.reply({
                content: 'No projects have been created yet.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📋 Available Projects')
            .setDescription(`Total Projects: ${allProjects.length}`)
            .setTimestamp();

        // Get user's assigned projects
        const userProjects = allProjects.filter(p =>
            dbHelpers.isUserAssignedToProject(userId, p.id)
        );

        if (userProjects.length > 0) {
            const projectList = userProjects.map(p => `• ${p.name}`).join('\n');
            embed.addFields({ name: '✅ Your Projects', value: projectList });
        }

        // Show other projects if admin
        const isAdmin = dbHelpers.isUserAdmin(userId);
        if (isAdmin && allProjects.length > userProjects.length) {
            const otherProjects = allProjects.filter(p =>
                !dbHelpers.isUserAssignedToProject(userId, p.id)
            );
            if (otherProjects.length > 0) {
                const otherList = otherProjects.map(p => `• ${p.name}`).join('\n');
                embed.addFields({ name: '📁 Other Projects', value: otherList });
            }
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
