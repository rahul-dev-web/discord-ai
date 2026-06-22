# 🗺️ FILE NAVIGATION GUIDE

## 📍 Where to Start?

### First Time Setup?
1. Read: `README.md` (2 min)
2. Read: `docs/SETUP_GUIDE.md` (15 min)
3. Follow setup steps
4. Run: `npm start`

### Want to Understand Architecture?
1. Read: `docs/ARCHITECTURE.md` (20 min)
2. Look at: `src/index.js` (entry point)
3. Explore engines: `src/engines/`
4. Check plugins: `src/plugins/`

### Want to Add Features?
1. Read: Plugin tutorial in `docs/ARCHITECTURE.md`
2. Copy: `src/plugins/base-plugin.js`
3. Create: `src/plugins/my-feature-plugin.js`
4. Test and deploy

### Need Help?
1. Check: Corresponding documentation file
2. Look at: Code comments in relevant file
3. Check: Example implementations
4. Create: GitHub issue

---

## 📂 Quick File Reference

### 🟢 **START HERE**
| File | Purpose | Time |
|------|---------|------|
| `README.md` | Overview & quick start | 2 min |
| `docs/SETUP_GUIDE.md` | Detailed setup | 15 min |
| `docs/ARCHITECTURE.md` | Technical deep dive | 20 min |

### 🔵 **MAIN APPLICATION**
| File | Purpose | When to Use |
|------|---------|-------------|
| `src/index.js` | Bot startup & initialization | Understand how bot starts |
| `src/core/firebase-config.js` | Database connection | Firebase issues |
| `src/core/event-bus.js` | Event communication | Plugin messaging |
| `src/core/config-manager.js` | Server settings | Change bot behavior |
| `src/core/plugin-loader.js` | Load plugins | Add plugins |

### 🟡 **ENGINES (Brain)**
| File | Purpose | When to Use |
|------|---------|-------------|
| `src/engines/context-engine.js` | Server state | Understand what bot knows |
| `src/engines/permission-engine.js` | Access control | Check permissions |
| `src/engines/capability-engine.js` | What bot can do | Add new capabilities |
| `src/engines/security-engine.js` | Safety & validation | Protect actions |
| `src/engines/task-manager.js` | Complex workflows | Multi-step operations |
| `src/engines/ai-engine.js` | AI brain (Groq) | Use AI features |

### 🟣 **PLUGINS (Features)**
| File | Purpose | When to Use |
|------|---------|-------------|
| `src/plugins/base-plugin.js` | Plugin template | Create new plugin |
| `src/plugins/ai-response-plugin.js` | AI replies | AI features |
| `src/plugins/tournament-plugin.js` | Tournaments | Tournament management |
| `src/plugins/support-plugin.js` | Support tickets | Help desk system |
| `src/plugins/moderation-plugin.js` | Moderation | Manage members |
| `src/plugins/analytics-plugin.js` | Statistics | View metrics |
| `src/plugins/voice-plugin.js` | Voice tracking | Voice analytics |

### 🔴 **COMMANDS (User Interface)**
| File | Purpose | When to Use |
|------|---------|-------------|
| `src/commands/help.js` | Help documentation | Add help text |
| `src/commands/setup.js` | Server setup wizard | Setup automation |
| `src/commands/tournament.js` | Tournament commands | Tournament features |
| `src/commands/stats.js` | Statistics commands | Analytics features |

### ⚪ **UTILITIES**
| File | Purpose | When to Use |
|------|---------|-------------|
| `src/utils/logger.js` | Logging system | Debug issues |
| `.env.example` | Configuration template | Setup variables |
| `package.json` | Dependencies | Install packages |
| `scripts/setup-wizard.js` | Interactive setup | Initial configuration |

---

## 🎯 Common Tasks & Which Files to Edit

### Task 1: Add New Command
**Files to edit**: `src/commands/newcommand.js`
**Also check**: `src/index.js` (how commands load)

```javascript
// Create: src/commands/newcommand.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('What it does'),
  
  async execute(interaction, client) {
    // Your code here
  },
};
```

### Task 2: Add New Plugin
**Files to edit**: `src/plugins/myplugin-plugin.js`
**Also check**: `src/core/plugin-loader.js`

```javascript
// Create: src/plugins/feature-plugin.js
const BasePlugin = require('./base-plugin');

class MyPlugin extends BasePlugin {
  constructor(client) {
    super(client);
    this.name = 'MyPlugin';
  }
  
  async onMessage(message) {
    // Handle messages
  }
}

module.exports = MyPlugin;
```

### Task 3: Add Database Feature
**Files to edit**: `src/engines/` or relevant plugin
**Also check**: `src/core/firebase-config.js`

```javascript
// In your engine/plugin:
const firebase = require('../core/firebase-config');

// Save data
await firebase.set('servers/{guildId}/mydata', data);

// Get data
const data = await firebase.get('servers/{guildId}/mydata');

// Update data
await firebase.update('servers/{guildId}/mydata', updates);
```

### Task 4: Add New Capability
**Files to edit**: `src/engines/capability-engine.js`
**Also check**: `src/engines/permission-engine.js`

```javascript
// In capability-engine.js, add to this.allCapabilities:
'my_new_capability': {
  description: 'What it does',
  riskLevel: 'medium',
  requiredRole: 'admin',
},
```

### Task 5: Fix Permissions Issue
**Files to check**: 
1. `src/engines/permission-engine.js` - Permission logic
2. `src/engines/security-engine.js` - Security rules
3. `.env` - Discord token & Firebase config
4. Firebase - User roles setup

### Task 6: Track New Metric
**Files to edit**: `src/plugins/analytics-plugin.js`
**Also check**: `src/commands/stats.js` (display data)

```javascript
// In analytics-plugin.js:
async trackMyMetric(guildId, data) {
  await firebase.push(`servers/${guildId}/my_metrics`, data);
}
```

### Task 7: Add Security Check
**Files to edit**: `src/engines/security-engine.js`
**Also check**: `src/engines/permission-engine.js`

```javascript
// In security-engine.js:
const riskLevel = this.assessRiskLevel(action);
// Returns: 'low', 'medium', 'high', or 'critical'
```

---

## 🔍 Code Search Tips

### Find where bot starts
```
→ src/index.js (look for "initializeBot")
```

### Find permission checks
```
→ src/engines/permission-engine.js
```

### Find database operations
```
→ src/core/firebase-config.js
```

### Find AI operations
```
→ src/engines/ai-engine.js
```

### Find all commands
```
→ src/commands/*.js
```

### Find all plugins
```
→ src/plugins/*-plugin.js
```

---

## 📖 Reading Order (For Beginners)

### Level 1: Get Started (1 hour)
1. `README.md` - Overview
2. `docs/SETUP_GUIDE.md` - Setup
3. Try: Run bot locally
4. Try: Run `/help` command

### Level 2: Understand Core (2 hours)
1. `src/index.js` - How bot loads
2. `src/core/firebase-config.js` - Database
3. `src/core/event-bus.js` - Events
4. `src/engines/context-engine.js` - Server state

### Level 3: Learn Architecture (3 hours)
1. `docs/ARCHITECTURE.md` - Full overview
2. All engines in `src/engines/`
3. Plugin system in `src/plugins/`
4. Commands in `src/commands/`

### Level 4: Advanced (ongoing)
1. Create custom plugins
2. Add new capabilities
3. Implement workflows
4. Optimize performance

---

## 🚨 When Something Goes Wrong

### Bot won't start
```
Check: src/index.js (startup code)
Check: .env file (tokens & config)
Check: logs/today.log (error messages)
```

### Command doesn't work
```
Check: src/commands/yourcommand.js
Check: Permission in permission-engine.js
Check: Capability in capability-engine.js
Check: Firebase connection in firebase-config.js
```

### Firebase error
```
Check: .env (Firebase credentials)
Check: Firebase rules in Firebase console
Check: Firebase quotas
```

### Plugin not loading
```
Check: Plugin file in src/plugins/
Check: src/core/plugin-loader.js
Check: Plugin name format: *-plugin.js
Check: logs for errors
```

---

## 💡 Helpful Patterns

### Pattern 1: Check Permission Before Action
```javascript
const canDo = await client.engines.permission.canPerformAction(
  member,
  'my_action',
  'high'
);
if (!canDo) {
  return await interaction.reply('❌ You cannot do this');
}
```

### Pattern 2: Save to Firebase
```javascript
const firebase = require('./firebase-config');
await firebase.set(`servers/${guildId}/mydata`, data);
```

### Pattern 3: Log Important Events
```javascript
const Logger = require('./logger');
Logger.info('Something happened');
Logger.error('Error occurred:', error);
Logger.success('Operation succeeded');
```

### Pattern 4: Create Embed Response
```javascript
const { EmbedBuilder } = require('discord.js');
const embed = new EmbedBuilder()
  .setColor('#0099ff')
  .setTitle('My Title')
  .addFields(
    { name: 'Field 1', value: 'Value 1', inline: true }
  );
await interaction.reply({ embeds: [embed] });
```

---

## 🎓 Learning Resources

### Understand Discord.js
- Official Docs: https://discordjs.guide/
- API Reference: https://discord.js.org/

### Understand Firebase
- Official Docs: https://firebase.google.com/docs
- Realtime DB: https://firebase.google.com/docs/database

### Understand Groq API
- Official Docs: https://console.groq.com/docs
- Models: https://console.groq.com/playground

### Node.js Async/Await
- MDN Guide: https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous

---

## 📞 Getting Help

### Check Code Comments
Most important functions have comments explaining what they do.

### Check Examples
Each feature has example implementations in:
- `src/plugins/` - Plugin examples
- `src/engines/` - Engine examples
- `src/commands/` - Command examples

### Check Logs
```bash
# View today's logs
cat logs/2024-01-15.log

# Follow logs in real time
tail -f logs/$(date +%Y-%m-%d).log
```

### Check Discord Logs
```bash
# View Render logs
# Dashboard → Your App → Logs
```

### Ask Questions
1. Create GitHub issue
2. Email support
3. Join Discord community

---

**Happy coding! 🚀**

Start with `README.md` → `docs/SETUP_GUIDE.md` → Try it locally!
