'use strict';

const { COLORS } = require('../config/constants');

module.exports = {
  name: 'channelDelete',
  async execute(client, channel) {
    if (!channel.guild) return;
    await client.logService.send(channel.guild.id, 'channel_delete', {
      description: `**Salon supprimé** : \`#${channel.name}\``,
      color: COLORS.DANGER
    });
  }
};
