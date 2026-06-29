const assert = require('node:assert/strict');
const test = require('node:test');
const { Collection } = require('discord.js');

process.env.SECURITY_SALT = 'test-security-salt-at-least-16';

const firebase = require('../src/core/firebase-config');
const WorkflowEngine = require('../src/engines/workflow-engine');

function installFirebaseMemoryStore() {
  const store = new Map();

  firebase.set = async (path, data) => {
    store.set(path, data);
    return true;
  };

  firebase.get = async (path) => store.get(path) || null;
  firebase.update = async (path, updates) => {
    store.set(path, { ...(store.get(path) || {}), ...updates });
    return true;
  };

  return store;
}

function createMockClient() {
  let counter = 0;
  const channelCache = new Collection();

  const guild = {
    id: 'guild-1',
    roles: {
      everyone: { id: 'everyone' },
      cache: new Collection(),
    },
    members: {
      fetch: async () => ({
        permissions: { has: () => true },
        roles: { add: async () => true },
      }),
    },
    channels: {
      cache: channelCache,
      create: async (config) => {
        counter += 1;
        const channel = {
          id: `channel-${counter}`,
          name: config.name,
          type: config.type,
          parent: config.parent,
          sentMessages: [],
          isTextBased: () => config.type === 0,
          send: async (payload) => {
            const message = { id: `message-${counter}-${channel.sentMessages.length + 1}`, payload };
            channel.sentMessages.push(message);
            return message;
          },
        };

        channelCache.set(channel.id, channel);
        return channel;
      },
    },
  };

  return {
    guild,
    client: {
      guilds: {
        cache: new Collection([['guild-1', guild]]),
      },
      users: {
        fetch: async () => ({ send: async () => true }),
      },
    },
  };
}

test('workflow requires explicit confirmation for confirmation steps', async () => {
  installFirebaseMemoryStore();
  const { client } = createMockClient();
  const engine = new WorkflowEngine(client);

  const execution = await engine.executeWorkflow('guild-1', 'tournament-setup', {
    executorId: 'owner-1',
    tournamentName: 'Summer Cup',
  });

  assert.equal(execution.status, 'FAILED');
  assert.match(execution.stepsFailed[0].error, /requires confirmation/i);
});

test('tournament setup workflow creates real channel ids and records bracket', async () => {
  const store = installFirebaseMemoryStore();
  const { client, guild } = createMockClient();
  const engine = new WorkflowEngine(client);

  const execution = await engine.executeWorkflow('guild-1', 'tournament-setup', {
    executorId: 'owner-1',
    tournamentName: 'Summer Cup',
    autoConfirm: true,
  });

  assert.equal(execution.status, 'SUCCESS');
  assert.equal(guild.channels.cache.size, 8);
  assert.ok(execution.context.tournamentCategoryId.startsWith('channel-'));
  assert.ok(execution.context.leaderboardMessageId.startsWith('message-'));
  assert.equal(store.size > 0, true);
});
