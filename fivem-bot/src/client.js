'use strict';

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const Database = require('./database/Database');
const LogService = require('./services/logService');
const TicketService = require('./services/ticketService');
const PresenceScheduler = require('./services/presenceScheduler');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const logger = require('./utils/logger');

function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember, Partials.User]
  });

  // Base de données zero-config : créée automatiquement au premier démarrage
  client.db = new Database();

  // Services métier, accessibles partout via client.xxx
  client.logService = new LogService(client, client.db);
  client.ticketService = new TicketService(client, client.db, client.logService);
  client.presenceScheduler = new PresenceScheduler(client, client.db, client.logService);

  // Chargement dynamique des commandes et events
  loadCommands(client);
  loadEvents(client);

  logger.info('Client Discord initialisé.');
  return client;
}

module.exports = { createClient };
