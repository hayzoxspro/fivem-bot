'use strict';

const { COLORS } = require('../config/constants');

module.exports = {
  name: 'inviteCreate',
  async execute(client, invite) {
    if (!invite.guild) return;
    await client.logService.send(invite.guild.id, 'invite', {
      description: `**Invitation créée** : \`${invite.code}\`\n**Par** : ${invite.inviter ? `${invite.inviter}` : 'Inconnu'}\n**Salon** : ${invite.channel}\n**Expire** : ${invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : 'Jamais'}`,
      color: COLORS.INFO
    });
  }
};
