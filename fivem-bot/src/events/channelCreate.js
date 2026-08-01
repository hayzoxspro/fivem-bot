'use strict';

const { COLORS } = require('../config/constants');

module.exports = {
  name: 'channelCreate',
  async execute(client, channel) {
    if (!channel.guild) return;
    await client.logService.send(channel.guild.id, 'channel_create', {
      description: `**Salon créé** : ${channel} (\`${channel.name}\`)`,
      color: COLORS.SUCCESS
    });
  }
};
