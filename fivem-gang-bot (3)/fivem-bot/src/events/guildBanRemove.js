'use strict';

const { COLORS } = require('../config/constants');

module.exports = {
  name: 'guildBanRemove',
  async execute(client, ban) {
    await client.logService.send(ban.guild.id, 'unban', {
      description: `**Membre débanni** : ${ban.user} (\`${ban.user.tag}\`)`,
      color: COLORS.SUCCESS
    });
  }
};
