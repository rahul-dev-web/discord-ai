# 🏗️ IGL DISCORD BOT - ARCHITECTURE GUIDE

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DISCORD.JS CLIENT                        │
│                   (Bot User Interface)                       │
└────────────┬────────────────────────────────────┬───────────┘
             │                                    │
      ┌──────▼─────┐                    ┌────────▼────────┐
      │  COMMANDS  │                    │   MESSAGE       │
      │  /help     │                    │   EVENT HANDLER │
      │  /setup    │                    │                 │
      │  /stats    │                    └────────┬────────┘
      └──────┬─────┘                             │
             │                ┌────────────────┬─┴──┐
             │                │                │    │
      ┌──────▼────────────────▼────────┐       │    │
      │        EVENT BUS               │       │    │
      │   (Inter-plugin communication) │       │    │
      └──────┬────────────────────────┘       │    │
             │                                │    │
      ┌──────▼────────────────────────────────▼───▼──────┐
      │              PLUGIN SYSTEM                       │
      │  ┌─────────────┐  ┌──────────────┐               │
      │  │ AI Response │  │ Support      │               │
      │  │ Plugin      │  │ Plugin       │               │
      │  └─────────────┘  └──────────────┘               │
      │  ┌──────────────┐  ┌──────────────┐  ┌────────┐│
      │  │ Tournament   │  │ Moderation   │  │ Voice  ││
      │  │ Plugin       │  │ Plugin       │  │ Plugin ││
      │  └──────────────┘  └──────────────┘  └────────┘│
      │  ┌──────────────────────────────────────────┐   │
      │  │ Analytics Plugin                         │   │
      │  └──────────────────────────────────────────┘   │
      └────┬─────────────────────────────────────────────┘
           │
      ┌────▼──────────────────────────────────────────┐
      │           ENGINE LAYER                       │
      │  ┌────────────────────────────────────────┐  │
      │  │ Context Engine                         │  │
      │  │ (Maintains server state in memory)     │  │
      │  └────────────────────────────────────────┘  │
      │  ┌────────────────────────────────────────┐  │
      │  │ Permission Engine                      │  │
      │  │ (Checks access control)                │  │
      │  └────────────────────────────────────────┘  │
      │  ┌────────────────────────────────────────┐  │
      │  │ Capability Engine                      │  │
      │  │ (Defines what bot can do)              │  │
      │  └────────────────────────────────────────┘  │
      │  ┌────────────────────────────────────────┐  │
      │  │ Security Engine                        │  │
      │  │ (Risk assessment & password protection)│  │
      │  └────────────────────────────────────────┘  │
      │  ┌────────────────────────────────────────┐  │
      │  │ Task Manager                           │  │
      │  │ (Complex multi-step operations)        │  │
      │  └────────────────────────────────────────┘  │
      │  ┌────────────────────────────────────────┐  │
      │  │ AI Engine                              │  │
      │  │ (Groq LLM integration)                 │  │
      │  └────────────────────────────────────────┘  │
      └────┬──────────────────────────────────────────┘
           │
      ┌────▼──────────────────────────────────────────┐
      │        CORE LAYER                            │
      │  ┌────────────────────────────────────────┐  │
      │  │ Firebase Config                        │  │
      │  │ (Database connection)                  │  │
      │  └────────────────────────────────────────┘  │
      │  ┌────────────────────────────────────────┐  │
      │  │ Config Manager                         │  │
      │  │ (Server settings)                      │  │
      │  └────────────────────────────────────────┘  │
      │  ┌────────────────────────────────────────┐  │
      │  │ Plugin Loader                          │  │
      │  │ (Dynamic plugin loading)               │  │
      │  └────────────────────────────────────────┘  │
      └────┬──────────────────────────────────────────┘
           │
      ┌────▼──────────────────────────────────────────┐
      │        DATA LAYER                            │
      │                                              │
      │  Firebase Realtime Database                  │
      │  • Configurations                            │
      │  • Tournaments                               │
      │  • Support Tickets                           │
      │  • Audit Logs                                │
      │  • Voice Sessions                            │
      │  • Analytics                                 │
      └──────────────────────────────────────────────┘
```

---

## Data Flow Examples

### Example 1: User Asks for Help

```
/help command
      ↓
src/commands/help.js
      ↓
AI Engine → Generate docs
      ↓
Discord Reply
```

### Example 2: Tournament Creation

```
/tournament create
      ↓
Check permissions (Permission Engine)
      ↓
Get capabilities (Capability Engine)
      ↓
AI Plans tournament setup (AI Engine)
      ↓
Create task (Task Manager)
      ↓
Execute steps (Plugin + Engines)
      ↓
Save to Firebase
      ↓
Audit log (Security Engine)
      ↓
Discord Reply
```

### Example 3: Voice Tracking

```
User joins Voice Channel
      ↓
onVoiceStateUpdate event
      ↓
Voice Plugin triggered
      ↓
Start session (Task Manager)
      ↓
Save to Firebase
      ↓
Update Context (Context Engine)
```

---

## Key Components Explained

### 1. **Engines**

#### Context Engine (`context-engine.js`)
**Purpose**: Maintains live "digital twin" of Discord server
**Stores**: Channels, roles, members, voice states
**Usage**: AI queries this instead of scanning server
**Benefit**: Reduces API calls, faster decisions

```javascript
// Example usage
const context = await client.engines.context.getServerContext(guildId);
console.log(context.channels); // All channels
console.log(context.roles);    // All roles
```

#### Permission Engine (`permission-engine.js`)
**Purpose**: Control who can do what
**Checks**: Discord perms, roles, trust score
**Usage**: Before executing actions
**Benefit**: Secure operations

```javascript
// Example usage
const canManage = await client.engines.permission
  .canPerformAction(member, 'create_tournament', 'high');
if (!canManage) return;
```

#### Capability Engine (`capability-engine.js`)
**Purpose**: Define what bot CAN do (not command-based)
**Defines**: 50+ capabilities like "manage_roles", "create_tournament"
**Usage**: AI checks capabilities, not hardcoded commands
**Benefit**: Extensible, future-proof

```javascript
// Example usage
const caps = await client.engines.capability
  .getMemberCapabilities(guildId, memberId);
// Returns: ['create_tournament', 'send_messages', ...]
```

#### Security Engine (`security-engine.js`)
**Purpose**: Protect dangerous actions
**Features**: Risk assessment, OTP, passwords, rate limiting
**Levels**: low, medium, high, critical
**Usage**: Multi-step validation for dangerous ops

```javascript
// Example usage
const riskLevel = client.engines.security
  .assessRiskLevel('delete_server'); // "critical"
// Needs: preview + confirmation + password
```

#### Task Manager (`task-manager.js`)
**Purpose**: Handle complex multi-step operations
**Features**: Pause, resume, rollback
**Usage**: Tournament setup, server backup
**Benefit**: Reliable, atomic operations

```javascript
// Example usage
const taskId = await client.engines.taskManager.createTask(
  guildId,
  'tournament_setup',
  'Create tournament',
  [
    { name: 'Create category', action: 'createCategory' },
    { name: 'Create roles', action: 'createRoles' },
    { name: 'Announce', action: 'sendAnnouncement' }
  ]
);
```

#### AI Engine (`ai-engine.js`)
**Purpose**: Brain of the bot (Groq LLM)
**Model**: Mixtral-8x7b (free tier)
**Features**: Plans actions, generates docs, analyzes intent
**Usage**: Decision making, responses

```javascript
// Example usage
const response = await client.engines.ai
  .generateResponse(message, context);
// Returns: AI-generated response
```

---

## Plugin System

### Create Custom Plugin

```javascript
// src/plugins/my-feature-plugin.js

const BasePlugin = require('./base-plugin');
const Logger = require('../utils/logger');

class MyFeaturePlugin extends BasePlugin {
  constructor(client) {
    super(client);
    this.name = 'MyFeature';           // Unique name
    this.version = '1.0.0';
    this.description = 'Does something cool';
  }

  async init() {
    Logger.info(`Initializing ${this.name}`);
    // Run on bot startup
  }

  async onMessage(message) {
    // Handle messages
    if (message.content.startsWith('!mycommand')) {
      await message.reply('Hello!');
    }
  }

  async onVoiceStateUpdate(oldState, newState) {
    // Handle voice events
  }

  async cleanup() {
    // Run on unload
    Logger.info(`Cleaning up ${this.name}`);
  }
}

module.exports = MyFeaturePlugin;
```

**Plugin Lifecycle**:
1. `init()` - Called when bot loads
2. Event handlers - Called when events occur
3. `cleanup()` - Called when plugin unloads

---

## Firebase Data Schema

### Server Config
```
configs/{guildId}
├── prefix: "!"
├── language: "en"
├── initialized: true
├── features:
│   ├── support: true
│   ├── tournament: true
│   ├── moderation: true
│   └── voice: true
└── roles:
    ├── owner: "ownerUserId"
    ├── admin: ["adminIds"]
    └── staff: ["staffIds"]
```

### Server Context
```
servers/{guildId}/context
├── channels: [{id, name, type, parent}]
├── roles: [{id, name, position, permissions}]
├── members: [{id, username, roles, joinedAt}]
├── voiceChannels: [{id, name, userCount}]
└── activeVoiceChannels: [...]
```

### Tournament
```
servers/{guildId}/tournaments/{tournamentId}
├── name: "Tournament Name"
├── type: "squad"          // solo, duo, squad, scrim, qualifier, finals
├── maxTeams: 32
├── status: "draft"        // draft, registration, live, completed
├── teams: [{name, members, status}]
├── matches: [{team1, team2, result, scheduledTime}]
└── createdAt: "2024-01-01T00:00:00Z"
```

### Support Ticket
```
servers/{guildId}/support_tickets/{ticketId}
├── subject: "Issue title"
├── description: "Details"
├── userId: "userId"
├── status: "open"         // open, in-progress, closed
├── messages: [{userId, content, timestamp}]
└── createdAt: "2024-01-01T00:00:00Z"
```

---

## Key Methods Reference

### Context Engine
```javascript
await client.engines.context.scanServer(guild);
await client.engines.context.getServerContext(guildId);
await client.engines.context.updateServerContext(guildId, updates);
```

### Permission Engine
```javascript
client.engines.permission.isOwner(guild, userId);
client.engines.permission.isAdmin(member);
await client.engines.permission.hasCapability(member, capability);
await client.engines.permission.canPerformAction(member, action);
```

### Capability Engine
```javascript
await client.engines.capability.getMemberCapabilities(guildId, memberId);
await client.engines.capability.hasCapability(guildId, memberId, capability);
await client.engines.capability.grantCapability(guildId, memberId, capability);
```

### Security Engine
```javascript
client.engines.security.assessRiskLevel(action);
await client.engines.security.logAction(guildId, userId, action, status, details);
await client.engines.security.getAuditLogs(guildId);
```

### Task Manager
```javascript
const taskId = await client.engines.taskManager.createTask(guildId, type, description, steps);
await client.engines.taskManager.executeTask(guildId, taskId, executor);
await client.engines.taskManager.pauseTask(guildId, taskId);
await client.engines.taskManager.rollbackTask(guildId, taskId, executor);
```

### AI Engine
```javascript
const response = await client.engines.ai.generateResponse(message, context);
const plan = await client.engines.ai.planAction(actionName, context, capabilities);
const analysis = await client.engines.ai.analyzeIntent(userMessage);
```

---

## Development Workflow

### 1. **Add New Feature**
```
Create Plugin → Add Engine Logic → Create Commands → Test
```

### 2. **Test Locally**
```bash
npm install
npm start
# Test in Discord server
```

### 3. **Deploy**
```bash
git add .
git commit -m "Feature: describe change"
git push origin main
# Render auto-deploys on push
```

### 4. **Monitor**
```bash
# Check Render logs
# View Firebase console
# Check Discord server
```

---

## Performance Optimization

### Context Caching
- Server context cached in memory
- Updated on server changes
- Prevents repeated API calls

### Firebase Batching
- Combine updates when possible
- Use transactions for critical ops
- Index frequently queried data

### Rate Limiting
- Built-in rate limit checks
- Per-user action limits
- Exponential backoff for retries

---

## Security Considerations

### Password Protection (Critical Actions)
- Hashed with PBKDF2
- Salt from environment variable
- OTP verification available

### Audit Logging
- All actions logged
- Timestamps and user IDs
- Queryable history

### Permission Hierarchy
- Owner > Admin > Staff > Moderator > User
- Capability-based, not command-based
- Extensible permission system

---

## Common Tasks

### Add a New Command
1. Create file in `src/commands/`
2. Use SlashCommandBuilder
3. Bot auto-loads on startup

### Create a Workflow
1. Define steps in Task Manager
2. Each step has action + rollback
3. Pause/resume support

### Track New Metric
1. Add tracking in plugin
2. Save to Firebase
3. Query in analytics

### Add Security Check
1. Use Security Engine
2. Define risk level
3. Require validation

---

**Happy Coding! 🚀**

For questions, check the code comments or create an issue.
