'use strict';

const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { COLORS } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Affiche les informations du serveur.'),
  async execute(interaction) {
    const guild = interaction.guild;
    const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;

    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle(`🏠 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }) || null)
      .addFields(
        { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Membres', value: `${guild.memberCount}`, inline: true },
        { name: 'Rôles', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Salons textuels', value: `${textChannels}`, inline: true },
        { name: 'Salons vocaux', value: `${voiceChannels}`, inline: true },
        { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
        { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
