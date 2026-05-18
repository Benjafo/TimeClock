# TimeClock Discord Bot

A Discord bot for tracking time spent on projects with admin management features.

## Features

### User Commands

- `/clockin <project>` - Clock in to a project
- `/clockout` - Clock out from your current project
- `/edit` - Edit past time entries
- `/projects` - List all available projects
- `/report [project]` - View time tracking reports (optionally filtered by project)
- `/status` - See currently clocked in status (admins see all users)

### Admin Commands

- `/createproject <name>` - Create a new project
- `/deleteproject` - Delete a project and all associated time entries
- `/editproject` - Rename an existing project
- `/summary [period]` - View team time summary (by week/month/all time)

## Prerequisites

- Node.js 16.x or higher (Node.js 22.x recommended)
- A Discord account with developer access
- A Discord server where you can add the bot

## Technical Details

- **Database:** SQLite with sql.js (pure JavaScript, no native compilation required)
- **Discord API:** discord.js v14
- **Time Storage:** All times stored in UTC, displayed in configured timezone

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
TIMEZONE=America/New_York
```

**Note:** The `TIMEZONE` variable uses IANA timezone format. Common values:

- `America/New_York` - Eastern Time
- `America/Chicago` - Central Time
- `America/Denver` - Mountain Time
- `America/Los_Angeles` - Pacific Time

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
2. Use `/projects` to see available projects
3. Use `/clockin <project>` to start tracking time on a project
4. Use `/status` to check if you're currently clocked in
5. Use `/clockout` when you're done working (no need to specify project)
6. Use `/report` to view your time entries and total hours
7. Use `/edit` to modify past time entries if needed

### For Admins

1. Use `/createproject <name>` to create new projects
2. Assign users to projects when creating them
3. Use `/status` to see who's currently working and what they're working on
4. Use `/summary` to view team time reports by person or project
5. Use `/editproject` to rename projects
6. Use `/deleteproject` to remove projects (this deletes all time entries!)

## Project Structure

```
TimeClock/
├── src/
│   ├── commands/           # Slash command implementations
│   │   ├── clockin.js      # Clock in to a project
│   │   ├── clockout.js     # Clock out from current project
│   │   ├── status.js       # View current clock-in status
│   │   ├── projects.js     # List available projects
│   │   ├── report.js       # View time reports
│   │   ├── summary.js      # Team summary (admin only)
│   │   ├── edit.js         # Edit time entries
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
└── README.md
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
