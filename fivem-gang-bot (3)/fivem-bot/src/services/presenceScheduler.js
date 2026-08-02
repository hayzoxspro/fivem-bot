'use strict';

const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../config/constants');
const { buildAttachment, attachmentUri } = require('../utils/imageStorage');
const logger = require('../utils/logger');

function formatDateFr(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return `${d}/${m}/${y}`;
}

class PresenceScheduler {
  constructor(client, db, logService) {
    this.client = client;
    this.db = db;
    this.logService = logService;
    this.task = null;
  }

  /** Vérifie chaque minute si une convocation doit être envoyée (se "réinitialise" chaque jour à minuit). */
  start() {
    if (this.task) return;
    this.task = cron.schedule('* * * * *', () => this.tick().catch((err) => logger.error('PresenceScheduler.tick', err)));
    logger.info('Scheduler de convocation démarré (vérification chaque minute).');
  }

  async tick() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const todayKey = now.toISOString().slice(0, 10); // change à minuit -> "réinitialise" l'envoi du jour

    for (const guild of this.client.guilds.cache.values()) {
      const guildConfig = this.db.getGuild(guild.id);
      const conv = guildConfig.convocation;
      if (!conv.enabled) continue;
      if (conv.hour !== hour || conv.minute !== minute) continue;
      if (conv.lastRunDate === todayKey) continue; // déjà envoyée aujourd'hui

      await this.fire(guild, conv).catch((err) => logger.error('PresenceScheduler.fire', err));
      conv.lastRunDate = todayKey;
      this.db.save();
    }
  }

  async fire(guild, conv) {
    const channel = guild.channels.cache.get(conv.channelId);
    if (!channel || !channel.isTextBased()) return;

    const now = new Date();
    const heureStr = `${String(conv.hour).padStart(2, '0')}h${conv.minute ? String(conv.minute).padStart(2, '0') : ''}`;
    const title = conv.title || `📢 Présence demandée le ${formatDateFr(now)} à ${heureStr}`;

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(title)
      .setDescription('Présent = ✅\nAbsent = ❌\nRetard = ⏳')
      .setFooter({ text: 'Gang Manager • Convocation quotidienne' })
      .setTimestamp();

    const files = [];
    const attachment = buildAttachment(conv.imageFile);
    if (attachment) {
      embed.setImage(attachmentUri(conv.imageFile));
      files.push(attachment);
    }

    const content = conv.roleId ? `<@&${conv.roleId}>` : null;

    const message = await channel.send({ content: content || undefined, embeds: [embed], files });
    for (const emoji of ['✅', '❌', '⏳']) {
      await message.react(emoji).catch(() => null);
    }
  }
}

module.exports = PresenceScheduler;
