'use strict';

const { COLORS } = require('../config/constants');

module.exports = {
  name: 'messageDelete',
  async execute(client, message) {
    if (!message.guild || message.author?.bot) return;
    const content = message.content ? message.content.slice(0, 800) : '*[contenu indisponible]*';
    await client.logService.send(message.guild.id, 'message_delete', {
      description: `**Auteur** : ${message.author ? `${message.author} (\`${message.author.tag}\`)` : 'Inconnu'}\n**Salon** : ${message.channel}\n**Contenu** :\n${content}`,
      color: COLORS.DANGER
    });
  }
};
