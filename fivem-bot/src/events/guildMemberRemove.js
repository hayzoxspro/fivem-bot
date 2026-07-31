'use strict';

const { AuditLogEvent } = require('discord.js');
const { baseEmbed, applyPlaceholders, parseColor } = require('../utils/embeds');
const { COLORS } = require('../config/constants');

function formatDuration(ms) {
  if (!ms || ms < 0) return 'inconnu';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days} jour(s) ${hours}h`;
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

module.exports = {
  name: 'guildMemberRemove',
  async execute(client, member) {
    const guildConfig = client.db.getGuild(member.guild.id);
    const l = guildConfig.leave;
    const duration = member.joinedTimestamp ? formatDuration(Date.now() - member.joinedTimestamp) : 'inconnu';

    if (l.enabled && l.channelId) {
      const channel = member.guild.channels.cache.get(l.channelId);
      if (channel && channel.isTextBased()) {
        const embed = baseEmbed(parseColor(l.color, COLORS.DANGER))
          .setTitle(applyPlaceholders(l.title, member))
          .setDescription(applyPlaceholders(l.description, member, { duration }));
        if (l.thumbnail) embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        await channel.send({ embeds: [embed] }).catch(() => null);
      }
    }

    // Détection kick via les logs d'audit (best-effort, nécessite la permission View Audit Log)
    let wasKicked = false;
    try {
      const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
      const entry = logs.entries.find((e) => e.target?.id === member.id && Date.now() - e.createdTimestamp < 5000);
      wasKicked = !!entry;
    } catch {
      /* pas de permission d'audit log */
    }

    await client.logService.send(member.guild.id, wasKicked ? 'kick' : 'member_leave', {
      description: `**${member.user.tag}** a quitté le serveur.\nTemps passé sur le serveur : **${duration}**`,
      color: COLORS.WARNING
    });
  }
};
