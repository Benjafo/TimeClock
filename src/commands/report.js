const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { dbHelpers } = require('../database/database');
const { formatDuration, formatDate } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('View your time tracking report')
        .addStringOption(option =>
            option.setName('project')
                .setDescription('Filter by specific project (optional)')
                .setRequired(false)
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

        let projectId = null;
        if (projectName) {
            const project = dbHelpers.getProject(projectName);
            if (!project) {
                return interaction.reply({
                    content: `Project "${projectName}" does not exist.`,
                    ephemeral: true
                });
            }
            projectId = project.id;
        }

        const entries = dbHelpers.getTimeEntries(userId, projectId, 50);

        if (entries.length === 0) {
            return interaction.reply({
                content: projectName
                    ? `No time entries found for project "${projectName}".`
                    : 'No time entries found.',
                ephemeral: true
            });
        }

        const completedEntries = entries.filter(e => e.clock_out !== null);
        const { hours, minutes } = dbHelpers.calculateTotalHours(completedEntries);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Time Report for ${interaction.user.username}`)
            .setDescription(projectName ? `Project: **${projectName}**` : 'All Projects')
            .addFields(
                { name: 'Total Time', value: formatDuration(hours, minutes), inline: true },
                { name: 'Total Entries', value: entries.length.toString(), inline: true },
                { name: 'Completed', value: completedEntries.length.toString(), inline: true }
            )
            .setTimestamp();

        const recentEntries = entries.slice(0, 10);
        let reportText = '';

        for (const entry of recentEntries) {
            const status = entry.clock_out ? '✅' : '⏱️';
            const clockIn = formatDate(entry.clock_in);
            const clockOut = entry.clock_out ? formatDate(entry.clock_out) : 'Still clocked in';

            let duration = '';
            if (entry.clock_out) {
                const diff = new Date(entry.clock_out) - new Date(entry.clock_in);
                const mins = diff / (1000 * 60);
                const h = Math.floor(mins / 60);
                const m = Math.floor(mins % 60);
                duration = ` (${formatDuration(h, m)})`;
            }

            reportText += `${status} **${entry.project_name}**\n`;
            reportText += `   In: ${clockIn}\n`;
            reportText += `   Out: ${clockOut}${duration}\n\n`;
        }

        embed.addFields({ name: 'Recent Entries', value: reportText || 'No entries' });

        if (entries.length > 10) {
            embed.setFooter({ text: `Showing 10 of ${entries.length} entries` });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
