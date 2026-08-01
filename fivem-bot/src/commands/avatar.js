'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { COLORS } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Affiche l\'avatar d\'un membre.')
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre à inspecter').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('membre') || interaction.user;
    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle(`🖼️ Avatar de ${user.tag}`)
      .setImage(user.displayAvatarURL({ size: 1024 }));
    await interaction.reply({ embeds: [embed] });
  }
};
