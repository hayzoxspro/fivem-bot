'use strict';

const { COLORS, LOG_TYPES, BRAND } = require('../config/constants');
const { baseEmbed } = require('../utils/embeds');
const logger = require('../utils/logger');

class LogService {
  constructor(client, db) {
    this.client = client;
    this.db = db;
  }

  /**
   * Envoie un embed de log dans le salon configuré pour ce type, s'il existe.
   * @param {string} guildId
   * @param {string} type - clé de LOG_TYPES
   * @param {{title?:string, description?:string, color?:number, fields?:Array}} options
   */
  async send(guildId, type, options = {}) {
    try {
      const guildConfig = this.db.getGuild(guildId);
      const channelId = guildConfig.logs.channels[type];
      if (!channelId) return;

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return;
      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) return;

      const meta = LOG_TYPES[type] || { label: type, emoji: '📄' };
      const embed = baseEmbed(options.color ?? COLORS.DARK)
        .setTitle(`${meta.emoji} ${options.title || meta.label}`)
        .setFooter({ text: BRAND.FOOTER })
        .setTimestamp();

      if (options.description) embed.setDescription(options.description);
      if (options.fields) embed.addFields(options.fields);

      await channel.send({ embeds: [embed] }).catch(() => null);
    } catch (err) {
      logger.error('LogService.send', err);
    }
  }

  async botError(guildId, error, context = '') {
    logger.error(context, error);
    if (!guildId) return;
    await this.send(guildId, 'bot_error', {
      description: `**Contexte :** ${context}\n**Erreur :** \`\`\`${String(error && error.message ? error.message : error).slice(0, 900)}\`\`\``
    });
  }
}

module.exports = LogService;
