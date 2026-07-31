'use strict';

const { baseEmbed } = require('../utils/embeds');
const { applyPlaceholders, parseColor } = require('../utils/embeds');
const { COLORS } = require('../config/constants');

module.exports = {
  name: 'guildMemberAdd',
  async execute(client, member) {
    const guildConfig = client.db.getGuild(member.guild.id);
    const w = guildConfig.welcome;

    if (w.enabled && w.channelId) {
      const channel = member.guild.channels.cache.get(w.channelId);
      if (channel && channel.isTextBased()) {
        const embed = baseEmbed(parseColor(w.color, COLORS.SUCCESS))
          .setTitle(applyPlaceholders(w.title, member))
          .setDescription(applyPlaceholders(w.description, member));
        if (w.thumbnail) embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        if (w.imageUrl) embed.setImage(w.imageUrl);
        if (w.footer) embed.setFooter({ text: w.footer });
        await channel.send({ embeds: [embed] }).catch(() => null);
      }
    }

    await client.logService.send(member.guild.id, 'member_join', {
      description: `${member} (\`${member.user.tag}\`) a rejoint le serveur.\nCompte créé <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>.`,
      color: COLORS.SUCCESS
    });
  }
};
