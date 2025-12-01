# TimeClock Discord Bot

A Discord bot for tracking time spent on projects with admin management features.

## Features

### User Commands
- `/clockin <project>` - Clock in to a project
- `/clockout <project>` - Clock out from a project
- `/report [project]` - View time tracking reports (optionally filtered by project)
- `/edit` - Edit past time entries with an interactive interface

### Admin Commands
- `/createproject <name>` - Create a new project
- `/editproject` - Rename an existing project
- `/deleteproject` - Delete a project and all associated time entries

## Prerequisites

- Node.js 16.x or higher
- A Discord account with developer access
- A Discord server where you can add the bot

## Setup Instructions

### 1. Create Discord Bot Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Navigate to the "Bot" section
4. Click "Add Bot"
5. Enable the following Privileged Gateway Intents:
   - SERVER MEMBERS INTENT
6. Copy the bot token (you'll need this later)

### 2. Get Required IDs

**Application/Client ID:**
- Found in the "General Information" section of your Discord application

**Guild/Server ID:**
1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click your server and select "Copy Server ID"

**Your User ID (for admin):**
1. Right-click your username in Discord and select "Copy User ID"

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_server_id_here
ADMIN_USER_ID=your_discord_user_id_here
DB_PATH=./data/timeclock.db
NODE_ENV=development
```

### 5. Initialize Database

```bash
npm run db:setup
```

This will create the database schema and set up the admin user.

### 6. Deploy Slash Commands

```bash
npm run deploy
```

This registers all slash commands with Discord.

### 7. Invite Bot to Your Server

1. Go to OAuth2 > URL Generator in the Discord Developer Portal
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

### 8. Start the Bot

```bash
npm start
```

The bot should now be online in your Discord server!

## Usage

### For Regular Users

1. Wait for an admin to create projects and assign you to them
2. Use `/clockin <project>` to start tracking time
3. Use `/clockout <project>` when you're done working
4. Use `/report` to view your time entries and total hours
5. Use `/edit` to modify past time entries if needed

### For Admins

1. Use `/createproject <name>` to create new projects
2. Assign users to projects (currently automatic when creating, or add assignuser command)
3. Use `/editproject` to rename projects
4. Use `/deleteproject` to remove projects (this deletes all time entries!)

## Project Structure

```
TimeClock/
├── src/
│   ├── commands/           # Slash command implementations
│   │   ├── clockin.js
│   │   ├── clockout.js
│   │   ├── report.js
│   │   ├── edit.js
│   │   ├── createproject.js
│   │   ├── editproject.js
│   │   └── deleteproject.js
│   ├── database/           # Database setup and helpers
│   │   ├── setup.js
│   │   └── database.js
│   ├── utils/              # Utility functions
│   │   └── permissions.js
│   └── index.js            # Main bot entry point
├── deploy-commands.js      # Command deployment script
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── IMPLEMENTATION_PLAN.md
└── DEPLOYMENT_GUIDE.md
```

## Troubleshooting

### Commands not showing up in Discord
- Make sure you ran `npm run deploy`
- Check that the bot has the `applications.commands` scope
- Try kicking and re-inviting the bot

### Bot not responding
- Check the console for errors
- Verify your `.env` file has correct values
- Ensure the bot has proper permissions in your server

### Database errors
- Make sure the `data/` directory exists and is writable
- Try running `npm run db:setup` again

### Permission denied errors
- Ensure you're using the correct Discord User ID for the admin
- The admin is set during database setup

## License

MIT
