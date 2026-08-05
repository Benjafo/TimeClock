# TimeClock Discord Bot

A Discord bot for tracking time spent on projects with admin management features.

## Features

### User Commands

- `/clockin [project]` - Clock in to a project (reply includes a Clock Out button); with no project, your default project is used
- `/clockinlast` - Clock in to the project you last worked on
- `/setdefaultproject [project] [clear]` - Set (or show/clear) the project `/clockin` uses when none is given
- `/clockout [note]` - Clock out from your current project, optionally noting what you worked on
- `/switch <project> [note]` - Clock out of your current project and into another in one step
- `/cancel` - Discard your current open entry without recording it (with confirmation)
- `/addentry <project>` - Add a past entry you forgot to clock (date/time picker or textboxes, per your config)
- `/edit [user]` - Edit past time entries (times and notes); `user` is admin only
- `/editlatest` - Jump straight to editing your most recent entry
- `/deleteentry [user]` - Delete one of your time entries (with confirmation); `user` is admin only
- `/projects` - List all available projects
- `/report [project] [last] [unit] [user]` - View time tracking reports, optionally filtered by project and/or a rolling period (e.g. `last:3 unit:days`); `user` is admin only
- `/export [project] [last] [unit] [team]` - Download entries as a CSV file (`team:true` is admin only)
- `/status` - See currently clocked in status (admins see all users)
- `/config ...` - View or change your personal settings (see below)
- `/help` - List all commands (admins also see the admin section)

### Admin Commands

- `/createproject <name>` - Create a new project
- `/deleteproject` - Delete a project and all associated time entries
- `/editproject` - Rename an existing project
- `/assign <user> <project>` - Assign a user to a project so they can clock in to it
- `/unassign <user> <project>` - Remove a user from a project (past entries are kept)
- `/members [project] [user]` - See who is assigned to a project, what projects a user has, or whether a specific user is on a specific project
- `/forceclockout <user> [note]` - Clock out another user who forgot to
- `/summary [period] [last] [unit]` - View team time summary (week/month/all time, or a custom rolling period)
- `/setadmin <user>` / `/removeadmin <user>` - Grant or revoke administrator access (the last admin cannot be removed)

### Personal Settings (`/config`)

Each user has their own settings; changing yours never affects anyone else.
`/config view` shows current values, `(default)` marks anything you haven't
changed. Format: `name: <options> [default]`

- `datepicker: <ui|textbox> [ui]` - How dates are entered when adding/editing entries
- `timepicker: <ui|textbox> [ui]` - How times are entered when adding/editing entries
- `autoclockoutduration: <number> <minutes|hours|days> [off]` - Automatically clock out after this long (`duration:0` turns it off)
- `longshiftnotification: <true|false> [true]` - Whether the bot DMs you when you stay clocked in past the long-shift threshold
- `timezone: <IANA zone|default> [server default]` - Timezone used when you type or view dates (autocomplete lists valid zones)

Your default project also appears in `/config view` and is managed with
`/setdefaultproject`.

### Date & Time Pickers

Wherever a date or time is entered (`/edit`, `/editlatest`, `/addentry`),
users with the default `ui` setting get a two-step picker on an ephemeral
message: dropdowns for the date (last few weeks, with an **Other date…**
option for anything older), hour, and exact minute — Step 1 sets clock-in,
Step 2 sets clock-out (with a **No clock-out** toggle when editing an open
entry) plus a **Notes…** button. Setting `datepicker`/`timepicker` to
`textbox` replaces that part of the picker with a typed
`YYYY-MM-DD` / `HH:MM:SS` field (both on `textbox` restores the classic
all-textbox modal).

### Reminders & Auto Clock-Out

Users clocked in longer than `REMINDER_HOURS` (default 8) receive a DM
reminding them to clock out or fix the entry. Set `REMINDER_HOURS=0` to
disable it server-wide; individual users can opt out with
`/config longshiftnotification enabled:false`.

Users who set `autoclockoutduration` are automatically clocked out once that
much time has elapsed — the entry is closed at exactly clock-in + duration,
`(auto clock-out)` is appended to its notes, and they get a DM. Both sweeps
run every 5 minutes.

## Prerequisites

- Node.js 16.x or higher (Node.js 22.x recommended)
- A Discord account with developer access
- A Discord server where you can add the bot

## Technical Details

- **Database:** SQLite with sql.js (pure JavaScript, no native compilation required)
- **Discord API:** discord.js v14
- **Time Storage:** All times stored in UTC. Messages use Discord's native timestamps, so each viewer sees their own local time; the `TIMEZONE` env var is the server-wide default for typed input, picker labels, and CSV exports, and each user can override it with `/config timezone`
- **Schema migrations:** New tables (e.g. `user_settings`) are created automatically at startup, so existing databases don't need `db:setup` re-run after upgrading

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

## Restarting & Upgrading

The process name below is whatever you passed to `pm2 start --name` — this
README uses `timeclock`; `guides/deployment.md` uses `timeclock-bot`. Check
with `pm2 status` if unsure.

**Restart the bot** (e.g. after changing `.env` or updating code):

```bash
pm2 restart timeclock
```

**Upgrade to a new version:**

```bash
git pull
npm install          # in case dependencies changed
npm run deploy       # re-register slash commands (needed when commands/options change)
pm2 restart timeclock
```

New database tables are created automatically at startup, so `db:setup`
does not need to be re-run on upgrades.

**Other useful commands:**

```bash
pm2 status                     # is the bot running?
pm2 logs timeclock             # tail the logs (Ctrl+C to exit)
pm2 logs timeclock --lines 100 # recent log history
pm2 stop timeclock             # stop without removing from pm2
```

**Running without pm2** (development): press `Ctrl+C` to stop the bot, then
`npm start` to start it again.

## Usage

### For Regular Users

1. Wait for an admin to create projects and assign you to them (`/assign`)
2. Use `/projects` to see available projects
3. Use `/clockin <project>` to start tracking time on a project — the
   confirmation includes a Clock Out button for when you're done. Set a
   default with `/setdefaultproject` and plain `/clockin` will use it, or
   use `/clockinlast` to jump back into whatever you worked on last
4. Use `/switch <project>` to move to a different project without clocking
   out manually first, and `/cancel` if you clocked in by mistake
5. Use `/status` to check if you're currently clocked in and for how long
6. Use `/clockout` when you're done working, optionally with a note about
   what you did (e.g. `/clockout note: Fixed the login bug`)
7. Use `/report` to view your entries and total hours — add `last` and
   `unit` for a rolling window (e.g. `/report last:14 unit:days` or
   `/report project:Website last:3 unit:months`)
8. Use `/editlatest` to fix your most recent entry, or `/edit` to pick an
   older one; `/addentry` logs a shift you forgot to clock, and
   `/deleteentry` removes an entry entirely
9. Use `/export` to download your entries as a CSV file
10. Use `/config` to tune things to your liking: date/time entry style
    (picker vs textbox), your timezone, auto clock-out, and the long-shift
    reminder DM. `/help` lists every command

If you stay clocked in longer than the configured `REMINDER_HOURS`, the bot
DMs you a reminder to clock out or fix the entry (disable yours with
`/config longshiftnotification enabled:false`).

### For Admins

1. Use `/createproject <name>` to create new projects (you're assigned
   automatically)
2. Use `/assign <user> <project>` to let teammates clock in to a project,
   and `/unassign` to remove them (their past entries are kept); `/members`
   shows who is assigned to what
3. Use `/status` to see who's currently working and what they're working on
4. Use `/forceclockout <user>` to close an entry someone forgot about, or
   fix/remove their entries directly with `/edit user:@name`,
   `/deleteentry user:@name`, and review them with `/report user:@name`
5. Use `/summary` to view team time reports by person or project — preset
   periods (week/month/all time) or a custom window like `last:48 unit:hours`
6. Use `/export team:true` to download the whole team's entries as CSV
7. Use `/editproject` to rename projects
8. Use `/deleteproject` to remove projects (this deletes all time entries!)
9. Use `/setadmin <user>` to share admin duties (and `/removeadmin` to
   revoke them — the last admin can't be removed)

## Project Structure

```
TimeClock/
├── src/
│   ├── commands/            # Slash command implementations
│   │   ├── clockin.js       # Clock in (default project fallback)
│   │   ├── clockinlast.js   # Clock in to your last project
│   │   ├── setdefaultproject.js # Manage your default project
│   │   ├── clockout.js      # Clock out (with optional note)
│   │   ├── switch.js        # Switch projects in one step
│   │   ├── cancel.js        # Discard your open entry
│   │   ├── addentry.js      # Add a forgotten past entry
│   │   ├── status.js        # View current clock-in status
│   │   ├── projects.js      # List available projects
│   │   ├── report.js        # View time reports (period filters)
│   │   ├── export.js        # Export entries as CSV
│   │   ├── summary.js       # Team summary (admin only)
│   │   ├── edit.js          # Edit time entries
│   │   ├── editlatest.js    # Edit the most recent entry
│   │   ├── deleteentry.js   # Delete a time entry
│   │   ├── config.js        # Per-user settings
│   │   ├── help.js          # Command listing
│   │   ├── assign.js        # Assign a user to a project (admin)
│   │   ├── unassign.js      # Remove a user from a project (admin)
│   │   ├── members.js       # Project assignments overview (admin)
│   │   ├── forceclockout.js # Clock out another user (admin)
│   │   ├── setadmin.js      # Grant admin access (admin)
│   │   ├── removeadmin.js   # Revoke admin access (admin)
│   │   ├── createproject.js
│   │   ├── editproject.js
│   │   └── deleteproject.js
│   ├── components/
│   │   └── datetimePicker.js # Staged date/time picker (selects + modals)
│   ├── config/
│   │   └── settings.js      # Setting definitions + typed access
│   ├── database/            # Database setup and helpers
│   │   ├── setup.js
│   │   └── database.js
│   ├── utils/               # Utility functions
│   │   ├── time.js          # Timezone-safe parsing/formatting
│   │   ├── permissions.js   # Admin checks, formatting re-exports
│   │   ├── sweeps.js        # Reminder + auto clock-out sweeps
│   │   └── deploy-commands.js # Command deployment script
│   └── index.js             # Main bot entry point + component routing
├── guides/
│   └── testing-checklist.md # Manual test checklist for releases
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
- Check the user hasn't opted out (`/config view` →
  `longshiftnotification`)

### Picker says "session expired"

- Picker sessions time out after 15 minutes of inactivity, and starting a
  new picker replaces the previous one — just run the command again

### New commands missing after an upgrade

- Run `npm run deploy` again whenever commands are added or their options
  change, then restart the bot

## License

MIT
