'use strict';

const { COLORS } = require('../config/constants');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(client, oldMember, newMember) {
    const guildId = newMember.guild.id;

    // Pseudo
    if (oldMember.nickname !== newMember.nickname) {
      await client.logService.send(guildId, 'nickname', {
        description: `${newMember} (\`${newMember.user.tag}\`)\n**Avant** : ${oldMember.nickname || oldMember.user.username}\n**Après** : ${newMember.nickname || newMember.user.username}`,
        color: COLORS.INFO
      });
    }

    // Rôles
    const addedRoles = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));
    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const parts = [];
      if (addedRoles.size > 0) parts.push(`**Ajoutés** : ${addedRoles.map((r) => `${r}`).join(', ')}`);
      if (removedRoles.size > 0) parts.push(`**Retirés** : ${removedRoles.map((r) => `${r}`).join(', ')}`);
      await client.logService.send(guildId, 'member_role_update', {
        description: `${newMember} (\`${newMember.user.tag}\`)\n${parts.join('\n')}`,
        color: COLORS.INFO
      });
    }

    // Timeout (communication désactivée)
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;
    if (oldTimeout !== newTimeout) {
      if (newTimeout && newTimeout > Date.now()) {
        await client.logService.send(guildId, 'timeout', {
          description: `${newMember} (\`${newMember.user.tag}\`) a été mis en timeout jusqu'à <t:${Math.floor(newTimeout / 1000)}:F>.`,
          color: COLORS.WARNING
        });
      } else if (oldTimeout) {
        await client.logService.send(guildId, 'timeout', {
          description: `Le timeout de ${newMember} (\`${newMember.user.tag}\`) a été levé.`,
          color: COLORS.SUCCESS
        });
      }
    }
  }
};
