# Implementation Plan for Discord Time Tracking Bot

## 1. Project Setup
- Initialize Node.js project with TypeScript (recommended) or JavaScript
- Install core dependencies:
  - `discord.js` - Discord bot framework
  - Database library (SQLite with `better-sqlite3` for simplicity, or PostgreSQL with `pg` for production)
  - `dotenv` - Environment variable management
- Create basic project structure: `/src/commands`, `/src/database`, `/src/utils`

## 2. Database Schema
Design four main tables:

### users
- `discord_id` (primary key)
- `username`
- `is_admin` (boolean)

### projects
- `id` (primary key)
- `name` (unique)
- `created_at`
- `created_by` (references users)

### time_entries
- `id` (primary key)
- `user_id` (references users)
- `project_id` (references projects)
- `clock_in` (timestamp)
- `clock_out` (timestamp, nullable)
- `notes` (optional text field)

### user_projects (assignment table)
- `user_id` (references users)
- `project_id` (references projects)
- Composite primary key on both fields

## 3. Configuration & Admin System
- Store bot token and initial admin Discord ID in `.env` file
- On first run, automatically set specified user as admin in database
- Create permission middleware that checks `is_admin` before executing admin commands
- All commands verify user is assigned to project before allowing clock in/out

## 4. Command Implementations

### Regular User Commands:
- `/clockin` - Check user assigned to project, verify not already clocked in, create time_entry
- `/clockout` - Find open time_entry for user/project, set clock_out timestamp
- `/report` - Query time_entries, calculate total hours, format as embed (show all projects if none specified)
- `/edit` - Show select menu of user's recent entries (last 10-20), allow editing clock in/out times via modal

### Admin Commands:
- `/createproject` - Insert new project, automatically assign to admin
- `/editproject` - Show select menu of projects, allow renaming via modal
- `/deleteproject` - Show select menu of projects with confirmation, cascade delete entries
- Admin should also be able to assign/unassign users to projects (consider `/assignuser` command)

## 5. Key Implementation Details

### Permission Checking:
- Every command handler first checks if user exists in database, creates if not
- Admin commands return error message if `is_admin` is false
- Clock in/out commands verify user is assigned to specified project

### Validation:
- Prevent clocking into project while already clocked in elsewhere
- Prevent clocking out when not clocked in
- Validate project names exist before operations
- Handle timezone considerations for timestamps

### User Experience:
- Use Discord embeds for rich formatting of reports
- Use select menus for `/edit`, `/editproject`, `/deleteproject` to avoid typing errors
- Use modals for collecting edit data (new timestamps, project names)
- Provide clear error messages when operations fail

### Data Integrity:
- Use database transactions for multi-step operations
- Add unique constraints (one open time_entry per user, unique project names)
- Consider cascade deletes vs. preventing deletion of projects with time entries

## 6. Command Registration
- Create `deploy-commands.js` script to register all slash commands with Discord API
- Define command options (required/optional parameters, autocomplete for project names)
- Run deployment script whenever commands change

## 7. Testing Checklist
- Clock in/out flow for single project
- Prevent double clock-in
- Report generation with/without project filter
- Edit past records and verify changes
- Admin creating/editing/deleting projects
- Non-admin attempting admin commands (should fail)
- User attempting to use unassigned project (should fail)
- Edge cases: midnight transitions, concurrent clock-ins, empty reports
