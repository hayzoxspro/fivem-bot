'use strict';

const { COLORS } = require('../config/constants');

module.exports = {
  name: 'messageUpdate',
  async execute(client, oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // évite le bruit (embeds, pin, etc.)

    await client.logService.send(newMessage.guild.id, 'message_update', {
      description: `**Auteur** : ${newMessage.author} (\`${newMessage.author.tag}\`)\n**Salon** : ${newMessage.channel}\n**Avant** :\n${(oldMessage.content || '*vide*').slice(0, 500)}\n**Après** :\n${(newMessage.content || '*vide*').slice(0, 500)}\n[Aller au message](${newMessage.url})`,
      color: COLORS.WARNING
    });
  }
};
