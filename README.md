# 🎮 IGL ESPORTS DISCORD BOT

> Production-ready Discord AI bot for esports team management, tournaments, and community engagement

![Discord.js](https://img.shields.io/badge/Discord.js-v14-blue)
![Firebase](https://img.shields.io/badge/Database-Firebase-orange)
![Groq](https://img.shields.io/badge/AI-Groq-brightgreen)
![Render](https://img.shields.io/badge/Hosting-Render-blueviolet)

---

## ✨ Features

### 🤖 AI-Powered Intelligence
- **Groq LLM Integration** - Free tier mixtral model
- **Context Awareness** - Understands server state
- **Natural Responses** - Speaks like a real person
- **Intent Analysis** - Knows what user wants

### 🏆 Tournament Management
- Create tournaments (solo, duo, squad, scrim, qualifier, finals)
- Team registration and bracket management
- Live leaderboards and scoring
- Match scheduling and result tracking
- Tournament history and analytics

### 💬 Support System
- Support ticket creation and tracking
- FAQ management with AI search
- Multi-member ticket collaboration
- Ticket prioritization

### 📊 Analytics & Insights
- Daily/weekly statistics
- Member activity tracking
- Voice session analytics
- Command usage tracking
- Detailed reports generation

### 🎤 Voice Channel Automation
- Automatic voice session tracking
- Member duration monitoring
- Voice channel statistics
- Active voice channel listing

### 🛡️ Advanced Moderation
- Warning system
- Temporary mutes
- Comprehensive audit logs
- Member status tracking
- Moderation history

### ⚙️ Enterprise Architecture
- **Plugin System** - Easily add features
- **Capability Engine** - Role-based access control
- **Security Engine** - Multi-level protection
- **Task Manager** - Complex workflow automation
- **Event Bus** - Inter-plugin communication

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Node.js 18+
- Discord Bot Token
- Firebase Account (free)
- Groq API Key (free)

### Step 1: Clone Repository
```bash
git clone https://github.com/yourusername/igl-discord-bot
cd igl-discord-bot
npm install
```

### Step 2: Create `.env` File
```bash
cp .env.example .env
```

### Step 3: Add Your Credentials
Edit `.env` with your tokens:
```env
DISCORD_TOKEN=your_bot_token
FIREBASE_API_KEY=your_firebase_key
FIREBASE_DATABASE_URL=your_database_url
GROQ_API_KEY=your_groq_key
SECURITY_SALT=random_string_here
```

### Step 4: Start Bot Locally
```bash
npm start
```

### Step 5: Add Bot to Discord
1. Go to Discord Developer Portal
2. Copy OAuth2 URL
3. Add bot to your server
4. Run `/setup` command

---

## 📋 Available Commands

### General
- `/help` - Show all commands
- `/help category:tournament` - Show tournament commands
- `/setup` - Initialize server (owner only)

### Tournaments
- `/tournament create` - Create new tournament
- `/tournament bracket [id]` - View bracket
- `/tournament leaderboard [id]` - View standings
- `/tournament list` - List all tournaments

### Statistics
- `/stats daily` - Today's statistics
- `/stats weekly` - Weekly statistics
- `/stats member [@user]` - Member activity

### Support (coming soon)
- `/ticket create` - Create support ticket
- `/faq search [query]` - Search FAQs

---

## 📁 Project Structure

```
igl-discord-bot/
├── src/
│   ├── index.js                      # Entry point
│   ├── core/
│   │   ├── firebase-config.js        # Database
│   │   ├── event-bus.js              # Event system
│   │   ├── config-manager.js         # Settings
│   │   └── plugin-loader.js          # Plugin system
│   ├── engines/
│   │   ├── context-engine.js         # Server state
│   │   ├── permission-engine.js      # Access control
│   │   ├── capability-engine.js      # Capabilities
│   │   ├── security-engine.js        # Security
│   │   ├── task-manager.js           # Workflows
│   │   └── ai-engine.js              # Groq LLM
│   ├── plugins/
│   │   ├── ai-response-plugin.js     # AI replies
│   │   ├── tournament-plugin.js      # Tournaments
│   │   ├── support-plugin.js         # Support
│   │   ├── moderation-plugin.js      # Moderation
│   │   ├── analytics-plugin.js       # Analytics
│   │   └── voice-plugin.js           # Voice tracking
│   ├── commands/
│   │   ├── help.js
│   │   ├── setup.js
│   │   ├── tournament.js
│   │   └── stats.js
│   └── utils/
│       └── logger.js
├── docs/
│   ├── SETUP_GUIDE.md               # Detailed setup
│   └── ARCHITECTURE.md              # Technical guide
├── scripts/
│   └── setup-wizard.js              # Interactive setup
└── package.json
```

---

## 🏗️ Architecture Overview

The bot uses a layered architecture:

```
Discord Events
     ↓
Commands & Message Handlers
     ↓
Plugins (Features)
     ↓
Engines (Business Logic)
     ↓
Firebase Database
```

### Core Engines

1. **Context Engine** - Maintains server state
2. **Permission Engine** - Controls access
3. **Capability Engine** - Defines what bot can do
4. **Security Engine** - Protects dangerous actions
5. **Task Manager** - Handles complex workflows
6. **AI Engine** - Powers intelligent responses

### Plugin System

Each feature is a plugin:
- `AIResponsePlugin` - Generates responses
- `TournamentPlugin` - Tournament management
- `SupportPlugin` - Support tickets
- `ModerationPlugin` - Moderation tools
- `AnalyticsPlugin` - Statistics
- `VoicePlugin` - Voice tracking

---

## 📱 Deployment

### Deploy to Render (Free)

1. Push code to GitHub
2. Connect Render to GitHub
3. Create Web Service
4. Add environment variables
5. Deploy

**Note**: Free tier spins down after 15 min. Use uptime monitor or upgrade tier.

### Alternative Hosting
- Railway
- Heroku
- AWS Lambda
- Self-hosted VPS

---

## 🔐 Security Features

- ✅ OTP-based authentication
- ✅ Role-based access control (RBAC)
- ✅ Capability-based authorization
- ✅ Risk assessment (low/medium/high/critical)
- ✅ Comprehensive audit logging
- ✅ Rate limiting
- ✅ Password protection for critical actions
- ✅ Recovery codes
- ✅ Trust score calculation

---

## 📊 Database Schema

### Firebase Realtime Database
- Free tier: 1 GB storage, 100 connections
- Structured storage:
  - Server configurations
  - Tournament data
  - Support tickets
  - Audit logs
  - Analytics data
  - Voice sessions

**Security Rules**: Read-only for guests, write restricted to owners

---

## 🤖 AI Capabilities

### Groq API Integration
- Model: Mixtral-8x7b (free tier)
- Use cases:
  - Intelligent responses
  - Action planning
  - Intent analysis
  - Documentation generation
  - FAQ answering
  - Tournament planning

### LLM Features
- Context-aware (understands server state)
- Never touches Discord API directly
- Supports streaming responses
- Respects rate limits

---

## 📈 Analytics

Track:
- Daily message counts
- Member join/leave
- Voice session duration
- Command usage
- Feature usage
- Member engagement

Generate reports with:
```bash
/stats daily
/stats weekly
/report generate
```

---

## 🔌 Plugin Development

Create custom plugins easily:

```javascript
const BasePlugin = require('./base-plugin');

class MyPlugin extends BasePlugin {
  constructor(client) {
    super(client);
    this.name = 'MyPlugin';
    this.description = 'Does something cool';
  }

  async onMessage(message) {
    // Handle messages
  }

  async init() {
    // Initialize
  }

  async cleanup() {
    // Cleanup
  }
}

module.exports = MyPlugin;
```

---

## 📚 Documentation

- **[SETUP_GUIDE.md](docs/SETUP_GUIDE.md)** - Complete setup instructions
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical deep dive
- **[API Reference](docs/API.md)** - All methods and functions

---

## 🐛 Troubleshooting

### Bot Won't Start
```
Error: DISCORD_TOKEN not found
→ Check .env file has correct token
```

### Firebase Connection Failed
```
Error: Firebase initialization failed
→ Verify credentials in .env
→ Check Firebase rules are correct
```

### Commands Not Showing
```
→ Restart bot or wait 1 hour
→ Check bot has slash_commands permission
```

### Need Help?
- Check logs: `logs/{date}.log`
- View Render logs in dashboard
- Create GitHub issue

---

## 📝 Configuration

### Environment Variables

```env
# Discord
DISCORD_TOKEN=your_token

# Firebase
FIREBASE_API_KEY=key
FIREBASE_AUTH_DOMAIN=domain
FIREBASE_DATABASE_URL=url
FIREBASE_PROJECT_ID=id
FIREBASE_STORAGE_BUCKET=bucket
FIREBASE_MESSAGING_SENDER_ID=id
FIREBASE_APP_ID=id

# Groq
GROQ_API_KEY=key

# Security
SECURITY_SALT=random_string

# Settings
NODE_ENV=production
LOG_LEVEL=INFO
PORT=3000
```

---

## 🚀 Roadmap

### Phase 1 ✅ Complete
- Core bot framework
- Plugin system
- AI integration
- Tournament management
- Support system

### Phase 2 (In Progress)
- Dashboard UI
- Advanced analytics
- Multi-server support
- Custom workflows

### Phase 3 (Planned)
- Plugin marketplace
- MCP integration
- Image generation
- Document AI

---

## 📄 License

MIT License - feel free to use and modify

---

## 🙏 Contributing

Contributions welcome! Please:
1. Fork repository
2. Create feature branch
3. Make changes
4. Submit pull request

---

## 📧 Support

- **Email**: support@iglsports.com
- **Discord**: Join our server
- **GitHub Issues**: Report bugs
- **Docs**: Read documentation

---

## 🎉 Credits

Built with ❤️ for **IGL Esports**

- **Discord.js** - Discord API library
- **Firebase** - Database
- **Groq** - AI Model API
- **Render** - Hosting

---

## 🌟 Star Us!

If you find this helpful, please star the repository!

```
⭐ IGL Discord Bot ⭐
```

---

**Last Updated**: 2024  
**Version**: 1.0.0  
**Status**: Production Ready ✅
