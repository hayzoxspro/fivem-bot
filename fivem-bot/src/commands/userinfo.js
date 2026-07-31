'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { COLORS } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Affiche les informations d\'un membre.')
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre à inspecter').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('membre') || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);

    const roles = member ? member.roles.cache.filter((r) => r.id !== interaction.guild.id).map((r) => `<@&${r.id}>`) : [];

    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Bot', value: user.bot ? 'Oui' : 'Non', inline: true },
        { name: 'Compte créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
        member
          ? { name: 'A rejoint le', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: false }
          : { name: 'A rejoint le', value: 'Inconnu', inline: false },
        { name: `Rôles (${roles.length})`, value: roles.length ? roles.slice(0, 20).join(' ') : 'Aucun', inline: false }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
