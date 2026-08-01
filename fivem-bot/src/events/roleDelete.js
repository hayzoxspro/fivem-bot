'use strict';

const { COLORS } = require('../config/constants');

module.exports = {
  name: 'roleDelete',
  async execute(client, role) {
    await client.logService.send(role.guild.id, 'role_delete', {
      description: `**Rôle supprimé** : \`${role.name}\``,
      color: COLORS.DANGER
    });
  }
};
