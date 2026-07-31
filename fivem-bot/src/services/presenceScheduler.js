'use strict';

const cron = require('node-cron');
const { baseEmbed } = require('../utils/embeds');
const { COLORS } = require('../config/constants');
const logger = require('../utils/logger');

class PresenceScheduler {
  constructor(client, db, logService) {
    this.client = client;
    this.db = db;
    this.logService = logService;
    this.task = null;
  }

  /** Démarre une vérification chaque minute pour déclencher les présences à l'heure configurée. */
  start() {
    if (this.task) return;
    this.task = cron.schedule('* * * * *', () => this.tick().catch((err) => logger.error('PresenceScheduler.tick', err)));
    logger.info('Scheduler de présences démarré (vérification chaque minute).');
  }

  async tick() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const todayKey = now.toISOString().slice(0, 10);

    for (const guild of this.client.guilds.cache.values()) {
      const guildConfig = this.db.getGuild(guild.id);
      let changed = false;
      for (const [id, presence] of Object.entries(guildConfig.presences)) {
        if (!presence.enabled) continue;
        if (presence.hour !== hour || presence.minute !== minute) continue;
        if (presence.lastRunDate === todayKey) continue; // déjà envoyée aujourd'hui

        await this.fire(guild, presence).catch((err) => logger.error('PresenceScheduler.fire', err));
        presence.lastRunDate = todayKey;
        changed = true;
      }
      if (changed) this.db.save();
    }
  }

  async fire(guild, presence) {
    const channel = guild.channels.cache.get(presence.channelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = baseEmbed(COLORS.PRIMARY).setTitle('📢 Présence Gang').setDescription(presence.text || 'Merci de confirmer votre présence.');

    const message = await channel.send({ embeds: [embed] });
    const reactions = presence.reactions && presence.reactions.length > 0 ? presence.reactions : ['✅', '❌', '⏳'];
    for (const emoji of reactions) {
      await message.react(emoji).catch(() => null);
    }
  }
}

module.exports = PresenceScheduler;
