# 🚀 IGL DISCORD BOT - COMPLETE SETUP GUIDE

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Create Discord Bot](#step-1-create-discord-bot)
3. [Step 2: Setup Firebase](#step-2-setup-firebase)
4. [Step 3: Get Groq API Key](#step-3-get-groq-api-key)
5. [Step 4: Local Setup](#step-4-local-setup)
6. [Step 5: Deploy to Render](#step-5-deploy-to-render)
7. [Project Structure](#project-structure)
8. [File Navigation](#file-navigation)
9. [Configuration Reference](#configuration-reference)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ installed
- Git installed
- GitHub account (for deployment)
- Free tier accounts for:
  - Discord Developer Portal
  - Firebase
  - Groq API
  - Render

---

## Step 1: Create Discord Bot

### 1.1 Go to Discord Developer Portal
```
https://discord.com/developers/applications
```

### 1.2 Create New Application
- Click "New Application"
- Enter name: "IGL Esports Bot"
- Click "Create"

### 1.3 Get Bot Token
1. Go to "Bot" section in left sidebar
2. Click "Add Bot"
3. Under TOKEN, click "Copy"
4. **SAVE THIS SAFELY** - Keep it secret!

### 1.4 Set Bot Permissions
1. Go to "OAuth2" → "URL Generator"
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select permissions:
   - Send Messages
   - Manage Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Manage Roles
   - Manage Channels
   - Read Members
   - View Channels
4. Copy the generated URL
5. Open it in browser to add bot to your server

### 1.5 Enable Required Intents
1. Go to "Bot" section
2. Turn ON:
   - Message Content Intent
   - Server Members Intent
   - Guild Presences Intent

---

## Step 2: Setup Firebase

### 2.1 Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Create a project"
3. Name: "igl-esports-bot"
4. Accept terms and create

### 2.2 Create Realtime Database
1. In left sidebar: "Realtime Database"
2. Click "Create Database"
3. Select region: `asia-south1` (nearest to India)
4. Start in **Test Mode** for now
5. Click "Enable"

### 2.3 Get Firebase Config
1. Go to Project Settings (gear icon)
2. Click "Service Accounts" tab
3. Under "Database Secrets", copy the URL
4. Under "Web API Key", note the API Key
5. Also note:
   - Project ID
   - Auth Domain
   - Storage Bucket
   - Messaging Sender ID
   - App ID

**Example URLs:**
```
API URL: https://your-project-id.firebaseio.com
Database URL: https://your-project-id-default-rtdb.asia-south1.firebasedatabase.app
```

### 2.4 Configure Security Rules (Important!)
```json
{
  "rules": {
    "servers": {
      "$guildId": {
        ".read": true,
        ".write": "root.child('configs').child($guildId).child('ownerId').val() === auth.uid",
        "configs": {
          ".read": true,
          ".write": true
        },
        "context": {
          ".read": true
        },
        "capabilities": {
          ".read": true
        },
        "audit_logs": {
          ".read": true
        },
        "tournaments": {
          ".read": true
        },
        "support_tickets": {
          ".read": true
        }
      }
    }
  }
}
```

---

## Step 3: Get Groq API Key

### 3.1 Sign Up for Groq
1. Go to https://console.groq.com/
2. Sign up with email/GitHub
3. Verify email

### 3.2 Create API Key
1. Click "API Keys" in sidebar
2. Click "Create New API Key"
3. Name it: "IGL Bot"
4. Copy the key
5. **SAVE IT SECURELY**

---

## Step 4: Local Setup

### 4.1 Clone and Setup Project

```bash
# Clone repository
git clone <your-repo-url>
cd igl-discord-bot

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### 4.2 Fill Environment Variables

Edit `.env` file:

```env
# Discord
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_client_id
GUILD_ID=your_test_server_id

# Firebase
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.asia-south1.firebasedatabase.app
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Groq
GROQ_API_KEY=your_groq_api_key

# Security
SECURITY_SALT=generated_random_string

# Settings
NODE_ENV=production
LOG_LEVEL=INFO
BOT_PREFIX=!
PORT=3000
```

### 4.3 Test Locally

```bash
# Register slash commands for your test server
npm run deploy:commands

# Start bot
npm start

# You should see:
# 🚀 Starting IGL Discord Bot...
# ✅ Bot is online as IGL Esports Bot#XXXX
```

### 4.4 Test Commands in Discord

Go to your test server and try:
```
/help
/setup
/stats daily
```

---

## Step 5: Deploy to Render

### 5.1 Push to GitHub

```bash
# Initialize git repo
git init
git add .
git commit -m "Initial commit: IGL Discord Bot"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 5.2 Create Render Account
1. Go to https://render.com/
2. Sign up with GitHub
3. Authorize Render to access your repositories

### 5.3 Deploy on Render

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `igl-discord-bot`
   - **Environment**: Node
   - **Build Command**: `npm run render:build`
   - **Start Command**: `npm run render:start`
   - **Plan**: Free

4. Add Environment Variables:
   - Click "Advanced" 
   - Add all variables from `.env`
   - Do not set `PORT`; Render provides it automatically

5. Register slash commands once:
   - Local terminal: `npm run deploy:commands`
   - Or Render Shell: `npm run deploy:commands`

6. Click "Deploy Web Service"

### 5.4 Monitor Deployment

1. Go to your Render dashboard
2. Watch the build logs
3. Once deployed, you'll get a unique URL
4. Open `https://your-service.onrender.com/health`
5. Bot will start automatically when health returns `{"status":"ok"}`

### 5.5 Keep Bot Running (Free Tier Limitation)

⚠️ **Important**: Free tier on Render spins down after 15 minutes of inactivity.

**Solutions:**
1. **Option A**: Use a free uptime monitor:
   - https://uptimerobot.com/
   - Ping your Render URL every 5 minutes

2. **Option B**: Upgrade to Paid ($7/month minimum)

3. **Option C**: Use multiple hosting:
   - Keep Discord bot on Render
   - Bot only needs to respond to Discord events

---

## Project Structure

```
igl-discord-bot/
├── src/
│   ├── index.js                    # Main entry point
│   ├── core/
│   │   ├── firebase-config.js      # Firebase initialization
│   │   ├── event-bus.js            # Event communication
│   │   ├── config-manager.js       # Server configuration
│   │   └── plugin-loader.js        # Plugin system
│   ├── engines/
│   │   ├── context-engine.js       # Server state tracking
│   │   ├── permission-engine.js    # Access control
│   │   ├── capability-engine.js    # Capability system
│   │   ├── security-engine.js      # Security & validation
│   │   ├── task-manager.js         # Complex operations
│   │   └── ai-engine.js            # Groq LLM integration
│   ├── plugins/
│   │   ├── base-plugin.js          # Plugin template
│   │   ├── ai-response-plugin.js   # AI responses
│   │   ├── support-plugin.js       # Support tickets
│   │   ├── tournament-plugin.js    # Tournaments
│   │   ├── moderation-plugin.js    # Moderation
│   │   ├── analytics-plugin.js     # Statistics
│   │   └── voice-plugin.js         # Voice tracking
│   ├── commands/
│   │   ├── help.js                 # Help command
│   │   ├── setup.js                # Setup wizard
│   │   ├── tournament.js           # Tournament commands
│   │   └── stats.js                # Analytics commands
│   ├── utils/
│   │   └── logger.js               # Logging utility
│   └── middleware/
├── scripts/
│   └── setup-wizard.js             # Setup script
├── logs/                           # Log files (auto-created)
├── .env.example                    # Environment template
├── package.json                    # Dependencies
└── README.md                       # Documentation
```

---

## File Navigation

### 🔴 **Core Files** (Start here)
1. **src/index.js** - How bot starts
2. **src/core/firebase-config.js** - Database connection
3. **src/engines/ai-engine.js** - AI brain

### 🟡 **Engines** (Business logic)
- **context-engine.js** - Knows server state
- **permission-engine.js** - Checks if user can do something
- **capability-engine.js** - Defines what bot can do
- **security-engine.js** - Protects dangerous actions
- **task-manager.js** - Handles complex workflows

### 🟢 **Plugins** (Features)
- **ai-response-plugin.js** - Replies to messages
- **support-plugin.js** - Help desk
- **tournament-plugin.js** - Competitions
- **moderation-plugin.js** - Safety
- **analytics-plugin.js** - Statistics
- **voice-plugin.js** - Voice tracking

### 🔵 **Commands** (User interface)
- **help.js** - Show commands
- **setup.js** - First setup
- **tournament.js** - Tournament management
- **stats.js** - View statistics

---

## Configuration Reference

### Firebase Data Structure

```
servers/
├── {guildId}/
│   ├── configs/
│   │   ├── prefix: "!"
│   │   ├── initialized: true
│   │   └── features: {support: true, ...}
│   ├── context/
│   │   ├── channels: [...]
│   │   ├── roles: [...]
│   │   └── members: [...]
│   ├── capabilities/
│   │   ├── owner: ["create_tournament", ...]
│   │   └── custom/{userId}/
│   ├── tournaments/
│   │   └── {tournamentId}/
│   ├── support_tickets/
│   │   └── {ticketId}/
│   ├── audit_logs/
│   └── voice_sessions/
```

### Command Examples

```
/help                           # Show help
/help category:tournament       # Help for tournaments
/setup                          # First-time setup
/tournament create name:"Scrims" type:scrim max_teams:32
/stats daily                    # Today's stats
/stats weekly                   # Week stats
/stats member user:@rahul       # User stats
```

---

## Troubleshooting

### Bot Won't Start

**Error**: `DISCORD_TOKEN not found`
- **Fix**: Check `.env` file has correct token

**Error**: `Firebase initialization failed`
- **Fix**: Verify Firebase credentials in `.env`

**Error**: `GROQ_API_KEY not found`
- **Fix**: Get key from https://console.groq.com/keys

### Bot Offline on Render

**Reason**: Free tier spins down after 15 min inactivity
- **Fix**: Use uptimerobot.com or upgrade tier

### Commands Not Showing

**Reason**: Slash commands not registered
- **Fix**: Restart bot or wait 1 hour for Discord cache

### Firebase Permission Denied

**Reason**: Security rules too strict
- **Fix**: Update Firebase rules (see Step 2.4)

### Need Help?

Create an issue on GitHub or check logs:
```bash
# Local logs
tail -f logs/$(date +%Y-%m-%d).log

# Render logs
# View in Render dashboard → Logs tab
```

---

## Next Steps

1. ✅ Deploy bot
2. 🎮 Add bot to your server
3. ⚙️ Run `/setup` command
4. 🏆 Create first tournament with `/tournament create`
5. 📊 Check stats with `/stats daily`
6. 🔌 Load more plugins as needed
7. 🚀 Scale with Render paid tier

---

**Made with ❤️ for IGL Esports**

Last updated: 2024
