const { dbHelpers } = require('../database/database');

async function checkAdminPermission(interaction) {
    const userId = interaction.user.id;
    const isAdmin = dbHelpers.isUserAdmin(userId);

    if (!isAdmin) {
        await interaction.reply({
            content: 'You do not have permission to use this command. Only administrators can use this command.',
            ephemeral: true
        });
        return false;
    }

    return true;
}

function formatDuration(hours, minutes) {
    if (hours === 0 && minutes === 0) {
        return '0 minutes';
    }

    const parts = [];
    if (hours > 0) {
        parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    }
    if (minutes > 0) {
        parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    }

    return parts.join(', ');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

module.exports = {
    checkAdminPermission,
    formatDuration,
    formatDate
};
