'use strict';

require('dotenv').config();
const logger = require('./src/utils/logger');
const { createClient } = require('./src/client');

if (!process.env.DISCORD_TOKEN) {
  logger.error('Variable d\'environnement DISCORD_TOKEN manquante. Ajoute-la sur Railway puis redéploie.');
  process.exit(1);
}

const client = createClient();

// ------------------------------------------------------------------
// Anti-crash : le bot ne doit jamais s'arrêter à cause d'une erreur
// asynchrone non gérée. On log et on continue de tourner.
// ------------------------------------------------------------------
process.on('unhandledRejection', (reason) => {
  logger.error('Promesse rejetée non gérée :', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Exception non interceptée :', err);
});
process.on('uncaughtExceptionMonitor', (err) => {
  logger.error('Exception non interceptée (monitor) :', err);
});

// ------------------------------------------------------------------
// Arrêt propre : on force la sauvegarde de la base avant de couper.
// ------------------------------------------------------------------
function shutdown(signal) {
  logger.info(`Signal ${signal} reçu, sauvegarde et arrêt du bot...`);
  try {
    client.db.saveSync();
  } catch (err) {
    logger.error('Erreur lors de la sauvegarde finale :', err);
  }
  client.destroy();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ------------------------------------------------------------------
// Connexion avec reconnexion automatique en cas d'échec initial.
// ------------------------------------------------------------------
function login(retryDelayMs = 5000) {
  client.login(process.env.DISCORD_TOKEN).catch((err) => {
    logger.error('Échec de connexion à Discord :', err.message);
    logger.info(`Nouvelle tentative dans ${retryDelayMs / 1000}s...`);
    setTimeout(() => login(Math.min(retryDelayMs * 2, 60000)), retryDelayMs);
  });
}

login();

client.on('shardDisconnect', () => logger.warn('Connexion Discord perdue, tentative de reconnexion automatique...'));
client.on('shardReconnecting', () => logger.info('Reconnexion à Discord en cours...'));
client.on('shardResume', () => logger.success('Connexion Discord rétablie.'));
