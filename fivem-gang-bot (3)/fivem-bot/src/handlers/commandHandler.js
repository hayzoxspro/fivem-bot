'use strict';

const fs = require('fs');
const path = require('path');
const { REST, Routes, Collection } = require('discord.js');
const logger = require('../utils/logger');

function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const command = require(path.join(commandsPath, file));
    if (!command || !command.data || !command.execute) {
      logger.warn(`Commande ignorée (structure invalide) : ${file}`);
      continue;
    }
    client.commands.set(command.data.name, command);
  }
  logger.info(`${client.commands.size} commande(s) chargée(s).`);
}

/** Enregistre automatiquement les slash commands auprès de l'API Discord (global). */
async function deployCommands(client) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const body = [...client.commands.values()].map((c) => c.data.toJSON());
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body });
    logger.success(`${body.length} slash commande(s) déployée(s) automatiquement.`);
  } catch (err) {
    logger.error('Erreur lors du déploiement des slash commands :', err);
  }
}

module.exports = { loadCommands, deployCommands };
