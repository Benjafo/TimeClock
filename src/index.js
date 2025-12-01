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
