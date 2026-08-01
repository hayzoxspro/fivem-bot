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
          name: '🎫 Tickets (ultra simple)',
          value:
            '`/ticket create` — crée ET publie un panel en une seule commande\n`/ticket addtype` `/ticket post` `/ticket delete` `/ticket list`'
        },
        {
          name: '⚙️ Configuration',
          value:
            '`/config welcome` `/config leave` `/config logs`\n`/config convocation set|off|preview|status` — présence quotidienne\n`/config autoreact` `/config permissions`'
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
