'use strict';

const { COLORS } = require('../config/constants');

module.exports = {
  name: 'guildBanAdd',
  async execute(client, ban) {
    await client.logService.send(ban.guild.id, 'ban', {
      description: `**Membre banni** : ${ban.user} (\`${ban.user.tag}\`)\n**Raison** : ${ban.reason || 'Non spécifiée'}`,
      color: COLORS.DANGER
    });
  }
};
