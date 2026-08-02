'use strict';

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (!message.guild || !message.author.bot || message.author.id !== client.user.id) return;

    const guildConfig = client.db.getGuild(message.guild.id);
    for (const config of Object.values(guildConfig.autoReact)) {
      if (config.type === 'bot' && config.enabled && config.channelId === message.channel.id) {
        for (const emoji of config.emojis) {
          await message.react(emoji).catch(() => null);
        }
      }
    }
  }
};
