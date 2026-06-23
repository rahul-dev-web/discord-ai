require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { registerSlashCommands } = require('./utils/command-registrar');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));

  if (!command.data?.toJSON) {
    console.warn(`Skipping ${file}: missing command.data`);
    continue;
  }

  commands.push(command.data);
}

(async () => {
  try {
    const result = await registerSlashCommands(commands, console);
    console.log(`Slash commands deployed: ${result.count} (${result.scope})`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();
