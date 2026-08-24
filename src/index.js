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

// customId prefix -> command, built from each command's componentPrefixes.
// Select menus, buttons, and modals are routed through this map.
const componentRoutes = new Map();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);

        for (const prefix of command.componentPrefixes || []) {
            if (componentRoutes.has(prefix)) {
                console.log(`[WARNING] Duplicate component prefix "${prefix}" in ${file}.`);
            }
            componentRoutes.set(prefix, command);
        }

        console.log(`Loaded command: ${command.data.name}`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Non-command component handlers (same interface: componentPrefixes +
// handleSelectMenu/handleButton/handleModalSubmit).
const datetimePicker = require('./components/datetimePicker');
for (const prefix of datetimePicker.componentPrefixes) {
    componentRoutes.set(prefix, datetimePicker);
}

function findComponentCommand(customId) {
    for (const [prefix, command] of componentRoutes) {
        if (customId.startsWith(prefix)) return command;
    }
    return null;
}

const { startBackgroundSweeps } = require('./utils/sweeps');

client.once(Events.ClientReady, readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    startBackgroundSweeps(client);
});

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
        } else if (
            interaction.isStringSelectMenu() ||
            interaction.isModalSubmit() ||
            interaction.isButton()
        ) {
            const command = findComponentCommand(interaction.customId);
            if (!command) {
                console.error(`No component handler for customId: ${interaction.customId}`);
                return;
            }

            if (interaction.isStringSelectMenu()) {
                await command.handleSelectMenu(interaction);
            } else if (interaction.isModalSubmit()) {
                await command.handleModalSubmit(interaction);
            } else {
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
