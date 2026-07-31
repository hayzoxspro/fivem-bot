'use strict';

const { ActivityType } = require('discord.js');
const { deployCommands } = require('../handlers/commandHandler');
const logger = require('../utils/logger');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    logger.success(`Connecté en tant que ${client.user.tag} (${client.guilds.cache.size} serveur(s)).`);

    await deployCommands(client);

    client.user.setPresence({
      activities: [{ name: 'le Gang 🎮 /help', type: ActivityType.Watching }],
      status: 'online'
    });

    client.presenceScheduler.start();

    logger.success('Bot prêt et opérationnel.');
  }
};
