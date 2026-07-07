# TimeClock Discord Bot

A Discord bot for tracking time spent on projects with admin management features.

## Features

### User Commands

- `/clockin <project>` - Clock in to a project (reply includes a Clock Out button)
- `/clockout [note]` - Clock out from your current project, optionally noting what you worked on
- `/switch <project> [note]` - Clock out of your current project and into another in one step
- `/edit` - Edit past time entries (times and notes)
- `/editlatest` - Jump straight to editing your most recent entry
- `/deleteentry` - Delete one of your time entries (with confirmation)
- `/projects` - List all available projects
- `/report [project] [last] [unit]` - View time tracking reports, optionally filtered by project and/or a rolling period (e.g. `last:3 unit:days`)
- `/export [project] [last] [unit] [team]` - Download entries as a CSV file (`team:true` is admin only)
- `/status` - See currently clocked in status (admins see all users)

### Admin Commands

- `/createproject <name>` - Create a new project
- `/deleteproject` - Delete a project and all associated time entries
- `/editproject` - Rename an existing project
- `/assign <user> <project>` - Assign a user to a project so they can clock in to it
- `/unassign <user> <project>` - Remove a user from a project (past entries are kept)
- `/forceclockout <user> [note]` - Clock out another user who forgot to
- `/summary [period] [last] [unit]` - View team time summary (week/month/all time, or a custom rolling period)

### Reminders

Users clocked in longer than `REMINDER_HOURS` (default 8) receive a DM
reminding them to clock out or fix the entry. Set `REMINDER_HOURS=0` to
disable.

## Prerequisites

- Node.js 16.x or higher (Node.js 22.x recommended)
- A Discord account with developer access
- A Discord server where you can add the bot

## Technical Details

- **Database:** SQLite with sql.js (pure JavaScript, no native compilation required)
- **Discord API:** discord.js v14
- **Time Storage:** All times stored in UTC. Messages use Discord's native timestamps, so each viewer sees their own local time; the `TIMEZONE` setting governs typed input (the edit modal), select-menu labels, and CSV exports

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
REMINDER_HOURS=4
```

**Note:** The `TIMEZONE` variable uses IANA timezone format. Common values:

- `America/New_York` - Eastern Time
- `America/Chicago` - Central Time
- `America/Denver` - Mountain Time
- `America/Los_Angeles` - Pacific Time

**Note:** `REMINDER_HOURS` controls when users get a DM about a possibly
forgotten clock-out (default 8 hours; set to `0` to disable).

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
pm2 start npm --name "timeclock" -- start
```

The bot should now be online in your Discord server!

## Usage

### For Regular Users

1. Wait for an admin to create projects and assign you to them (`/assign`)
2. Use `/projects` to see available projects
3. Use `/clockin <project>` to start tracking time on a project — the
   confirmation includes a Clock Out button for when you're done
4. Use `/switch <project>` to move to a different project without clocking
   out manually first
5. Use `/status` to check if you're currently clocked in and for how long
6. Use `/clockout` when you're done working, optionally with a note about
   what you did (e.g. `/clockout note: Fixed the login bug`)
7. Use `/report` to view your entries and total hours — add `last` and
   `unit` for a rolling window (e.g. `/report last:14 unit:days` or
   `/report project:Website last:3 unit:months`)
8. Use `/editlatest` to fix your most recent entry, or `/edit` to pick an
   older one; `/deleteentry` removes an entry entirely
9. Use `/export` to download your entries as a CSV file

If you stay clocked in longer than the configured `REMINDER_HOURS`, the bot
DMs you a reminder to clock out or fix the entry.

### For Admins

1. Use `/createproject <name>` to create new projects (you're assigned
   automatically)
2. Use `/assign <user> <project>` to let teammates clock in to a project,
   and `/unassign` to remove them (their past entries are kept)
3. Use `/status` to see who's currently working and what they're working on
4. Use `/forceclockout <user>` to close an entry someone forgot about
5. Use `/summary` to view team time reports by person or project — preset
   periods (week/month/all time) or a custom window like `last:48 unit:hours`
6. Use `/export team:true` to download the whole team's entries as CSV
7. Use `/editproject` to rename projects
8. Use `/deleteproject` to remove projects (this deletes all time entries!)

## Project Structure

```
TimeClock/
├── src/
│   ├── commands/            # Slash command implementations
│   │   ├── clockin.js       # Clock in to a project
│   │   ├── clockout.js      # Clock out (with optional note)
│   │   ├── switch.js        # Switch projects in one step
│   │   ├── status.js        # View current clock-in status
│   │   ├── projects.js      # List available projects
│   │   ├── report.js        # View time reports (period filters)
│   │   ├── export.js        # Export entries as CSV
│   │   ├── summary.js       # Team summary (admin only)
│   │   ├── edit.js          # Edit time entries
│   │   ├── editlatest.js    # Edit the most recent entry
│   │   ├── deleteentry.js   # Delete a time entry
│   │   ├── assign.js        # Assign a user to a project (admin)
│   │   ├── unassign.js      # Remove a user from a project (admin)
│   │   ├── forceclockout.js # Clock out another user (admin)
│   │   ├── createproject.js
│   │   ├── editproject.js
│   │   └── deleteproject.js
│   ├── database/            # Database setup and helpers
│   │   ├── setup.js
│   │   └── database.js
│   ├── utils/               # Utility functions
│   │   ├── time.js          # Timezone-safe parsing/formatting
│   │   ├── permissions.js   # Admin checks, formatting re-exports
│   │   └── deploy-commands.js # Command deployment script
│   └── index.js             # Main bot entry point + reminder sweep
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

### Users can't clock in to a project

- Users must be assigned to a project first — use `/assign <user> <project>`
- `/clockin` autocomplete only suggests projects the user is assigned to

### Reminder DMs not arriving

- The recipient may have DMs from server members disabled in their privacy
  settings — the bot logs a warning in the console when a DM fails
- Check that `REMINDER_HOURS` is not set to `0`

## License

MIT
