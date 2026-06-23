const { REST, Routes } = require('discord.js');

async function registerSlashCommands(commands, logger = console) {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    const missing = [
      !token && 'DISCORD_TOKEN',
      !clientId && 'CLIENT_ID',
    ].filter(Boolean);

    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const body = commands.map((command) => {
    if (typeof command.toJSON === 'function') {
      return command.toJSON();
    }

    if (command.data && typeof command.data.toJSON === 'function') {
      return command.data.toJSON();
    }

    return command;
  });

  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  await rest.put(route, { body });

  const scope = guildId ? `guild ${guildId}` : 'global';
  logger.info?.(`Registered ${body.length} slash commands for ${scope}`);

  return { count: body.length, scope };
}

module.exports = { registerSlashCommands };
