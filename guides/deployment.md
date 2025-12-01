# Discord Bot Deployment Guide for DigitalOcean VPS

## Prerequisites
- DigitalOcean VPS (droplet) with at least 1GB RAM
- SSH access to your server
- Discord account with developer access
- Domain name (optional, but recommended for easier management)

## Step 1: Initial Server Setup

### 1.1 Connect to Your VPS
```bash
ssh root@your_server_ip
```

### 1.2 Create a Non-Root User
```bash
adduser botuser
usermod -aG sudo botuser
su - botuser
```

### 1.3 Update System Packages
```bash
sudo apt update
sudo apt upgrade -y
```

### 1.4 Configure Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw enable
```

## Step 2: Install Required Software

### 2.1 Install Node.js (LTS version)
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

### 2.2 Install Git
```bash
sudo apt install git -y
```

### 2.3 Install Database

**For SQLite (simpler, good for small-medium usage):**
```bash
sudo apt install sqlite3 -y
```

**For PostgreSQL (better for production):**
```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE timeclock_bot;
CREATE USER botuser WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE timeclock_bot TO botuser;
\q
```

### 2.4 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

## Step 3: Set Up Discord Bot Application

### 3.1 Create Bot in Discord Developer Portal
1. Go to https://discord.com/developers/applications
2. Click "New Application" and name it (e.g., "TimeClock Bot")
3. Navigate to "Bot" section in left sidebar
4. Click "Add Bot"
5. Under "Privileged Gateway Intents", enable:
   - SERVER MEMBERS INTENT (to read user info)
   - MESSAGE CONTENT INTENT (if needed for future features)
6. Copy the bot token (you'll need this later)

### 3.2 Set Bot Permissions
1. Go to "OAuth2" > "URL Generator"
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands
4. Copy the generated URL and use it to invite the bot to your server

### 3.3 Get Your Discord User ID (for admin)
1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click your username and select "Copy User ID"
3. Save this ID for configuration

## Step 4: Deploy the Bot Code

### 4.1 Create Project Directory
```bash
mkdir -p ~/discord-bots/timeclock
cd ~/discord-bots/timeclock
```

### 4.2 Transfer Your Bot Code
**Option A: Using Git (recommended)**
```bash
git clone https://github.com/yourusername/timeclock-bot.git .
```

**Option B: Using SCP from local machine**
```bash
# Run this from your local machine
scp -r /path/to/local/timeclock/* botuser@your_server_ip:~/discord-bots/timeclock/
```

### 4.3 Install Dependencies
```bash
npm install
```

### 4.4 Build TypeScript (if using TypeScript)
```bash
npm run build
```

## Step 5: Configure Environment Variables

### 5.1 Create .env File
```bash
nano .env
```

### 5.2 Add Configuration
```env
# Discord Configuration
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_server_id_here
ADMIN_USER_ID=your_discord_user_id_here

# Database Configuration (for PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=timeclock_bot
DB_USER=botuser
DB_PASSWORD=your_secure_password

# Or for SQLite
DB_PATH=/home/botuser/discord-bots/timeclock/data/timeclock.db

# Environment
NODE_ENV=production
```

Save and exit (Ctrl+X, then Y, then Enter)

### 5.3 Secure the .env File
```bash
chmod 600 .env
```

## Step 6: Initialize Database

### 6.1 Create Data Directory (for SQLite)
```bash
mkdir -p data
```

### 6.2 Run Database Migrations
```bash
npm run migrate
# Or if you have a setup script:
npm run db:setup
```

## Step 7: Deploy Slash Commands

### 7.1 Register Commands with Discord
```bash
node deploy-commands.js
# Or: npm run deploy-commands
```

You should see confirmation that commands were registered successfully.

## Step 8: Start the Bot with PM2

### 8.1 Start Bot Process
```bash
pm2 start npm --name "timeclock-bot" -- start
# Or if using a specific entry file:
pm2 start dist/index.js --name "timeclock-bot"
```

### 8.2 Configure PM2 to Start on Boot
```bash
pm2 startup systemd
# Copy and run the command that PM2 outputs
pm2 save
```

### 8.3 Verify Bot is Running
```bash
pm2 status
pm2 logs timeclock-bot
```

## Step 9: Set Up Logging and Monitoring

### 9.1 Configure PM2 Log Rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 9.2 Monitor Bot Health
```bash
# View real-time logs
pm2 logs timeclock-bot

# View bot status
pm2 status

# Monitor resources
pm2 monit
```

## Step 10: Maintenance Commands

### Update Bot Code
```bash
cd ~/discord-bots/timeclock
git pull origin main  # If using git
npm install           # Install new dependencies
npm run build         # If using TypeScript
pm2 restart timeclock-bot
```

### Backup Database

**For SQLite:**
```bash
cp data/timeclock.db data/timeclock.db.backup-$(date +%Y%m%d)
```

**For PostgreSQL:**
```bash
pg_dump -U botuser timeclock_bot > backup-$(date +%Y%m%d).sql
```

### View Logs
```bash
pm2 logs timeclock-bot --lines 100
```

### Restart Bot
```bash
pm2 restart timeclock-bot
```

### Stop Bot
```bash
pm2 stop timeclock-bot
```

### Remove Bot from PM2
```bash
pm2 delete timeclock-bot
```

## Security Best Practices

1. **Keep system updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Use SSH keys instead of passwords** for server access

3. **Never commit .env file** to version control

4. **Regularly backup database:**
   - Set up automated backups using cron
   ```bash
   crontab -e
   # Add line for daily backup at 2 AM:
   0 2 * * * cd ~/discord-bots/timeclock && ./backup.sh
   ```

5. **Monitor disk space:**
   ```bash
   df -h
   ```

6. **Set up fail2ban** to prevent brute force attacks:
   ```bash
   sudo apt install fail2ban -y
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

## Troubleshooting

### Bot Won't Start
```bash
# Check logs
pm2 logs timeclock-bot --err

# Check if port is in use
sudo netstat -tulpn | grep <port>

# Verify environment variables
cat .env
```

### Bot Not Responding to Commands
- Verify bot has proper permissions in Discord server
- Check that slash commands were deployed: `node deploy-commands.js`
- Ensure bot token is correct in .env
- Check logs for errors: `pm2 logs timeclock-bot`

### Database Connection Issues
- Verify database is running: `sudo systemctl status postgresql`
- Check database credentials in .env
- Ensure database exists and user has proper permissions

### Out of Memory
```bash
# Check memory usage
free -h

# Restart bot to clear memory
pm2 restart timeclock-bot

# Consider upgrading VPS if persistent
```
