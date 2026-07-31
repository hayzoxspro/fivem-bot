'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { COLORS } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Affiche la liste des commandes disponibles.'),
  async execute(interaction) {
    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('📖 Aide — Gang Manager')
      .setDescription('Voici toutes les commandes disponibles.')
      .addFields(
        {
          name: '🔧 Général',
          value: '`/ping` `/help` `/userinfo` `/serverinfo` `/avatar` `/dashboard`'
        },
        {
          name: '🎫 Tickets',
          value:
            '`/ticket category create|edit|delete|list`\n`/ticket panel create|addcategory|post|delete|list`'
        },
        {
          name: '⚙️ Configuration',
          value:
            '`/config welcome` `/config leave` `/config logs` `/config presence` `/config autoreact` `/config permissions`'
        },
        {
          name: '🖼️ Générateur d\'embeds',
          value: '`/embed create` `/embed addfield` `/embed setbutton` `/embed preview` `/embed send`'
        }
      )
      .setFooter({ text: 'Gang Manager • Tape / pour voir toutes les commandes' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
