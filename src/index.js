const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    startForgottenClockoutReminders();
});

// DM users who have been clocked in longer than REMINDER_HOURS (default 8).
// Set REMINDER_HOURS=0 to disable. Reminders are tracked in memory, so a
// restart may re-send at most one extra reminder per open entry.
function startForgottenClockoutReminders() {
    const reminderHours = process.env.REMINDER_HOURS === undefined
        ? 8
        : Number(process.env.REMINDER_HOURS);

    if (!reminderHours || Number.isNaN(reminderHours)) {
        console.log('Forgotten clock-out reminders disabled.');
        return;
    }

    const { dbHelpers } = require('./database/database');
    const { parseDbDate, discordTimestamp } = require('./utils/time');
    const remindedEntryIds = new Set();

    setInterval(async () => {
        try {
            const openEntries = dbHelpers.getAllOpenEntries();
            const cutoff = Date.now() - reminderHours * 3600000;

            for (const entry of openEntries) {
                if (remindedEntryIds.has(entry.id)) continue;
                if (parseDbDate(entry.clock_in).getTime() > cutoff) continue;

                remindedEntryIds.add(entry.id);
                try {
                    const user = await client.users.fetch(entry.discord_id);
                    await user.send(
                        `⏰ You have been clocked in to **${entry.project_name}** since ` +
                        `${discordTimestamp(entry.clock_in)} (${discordTimestamp(entry.clock_in, 'R')}). ` +
                        `If you forgot to clock out, use /clockout or fix the entry with /editlatest.`
                    );
                } catch (dmError) {
                    console.error(`Could not DM reminder to ${entry.username}:`, dmError.message);
                }
            }
        } catch (error) {
            console.error('Error in forgotten clock-out sweep:', error);
        }
    }, 30 * 60 * 1000);

    console.log(`Forgotten clock-out reminders enabled (threshold: ${reminderHours}h).`);
}

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            await command.execute(interaction);
        } else if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);

            if (!command || !command.autocomplete) {
                return;
            }

            await command.autocomplete(interaction);
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'edit_entry_select') {
                const command = client.commands.get('edit');
                await command.handleSelectMenu(interaction);
            } else if (interaction.customId === 'edit_project_select') {
                const command = client.commands.get('editproject');
                await command.handleSelectMenu(interaction);
            } else if (interaction.customId === 'delete_project_select') {
                const command = client.commands.get('deleteproject');
                await command.handleSelectMenu(interaction);
            } else if (interaction.customId === 'delete_entry_select') {
                const command = client.commands.get('deleteentry');
                await command.handleSelectMenu(interaction);
            }
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('edit_entry_modal_')) {
                const command = client.commands.get('edit');
                await command.handleModalSubmit(interaction);
            } else if (interaction.customId.startsWith('edit_project_modal_')) {
                const command = client.commands.get('editproject');
                await command.handleModalSubmit(interaction);
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('delete_project_')) {
                const command = client.commands.get('deleteproject');
                await command.handleButton(interaction);
            } else if (interaction.customId.startsWith('delete_entry_')) {
                const command = client.commands.get('deleteentry');
                await command.handleButton(interaction);
            } else if (interaction.customId.startsWith('clockout_button_')) {
                const command = client.commands.get('clockout');
                await command.handleButton(interaction);
            } else if (interaction.customId.startsWith('editlatest_button_')) {
                const command = client.commands.get('editlatest');
                await command.handleButton(interaction);
            }
        }
    } catch (error) {
        console.error('Error handling interaction:', error);

        const errorMessage = {
            content: 'There was an error while executing this command!',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
