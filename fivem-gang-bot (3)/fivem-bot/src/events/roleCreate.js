'use strict';

const { COLORS } = require('../config/constants');

module.exports = {
  name: 'roleCreate',
  async execute(client, role) {
    await client.logService.send(role.guild.id, 'role_create', {
      description: `**Rôle créé** : ${role} (\`${role.name}\`)`,
      color: COLORS.SUCCESS
    });
  }
};
