'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { COLORS } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Affiche la liste des commandes disponibles.'),
  async execute(interaction) {
    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('📖 Aide — Gang Manager')
      .setDescription('👉 Tape simplement **`/setup`** pour tout configurer en cliquant, sans rien taper.')
      .addFields(
        {
          name: '🛠️ Configuration simple',
          value: '`/setup` — assistant complet (tickets, arrivée, convocation) en quelques clics'
        },
        {
          name: '🔧 Général',
          value: '`/ping` `/help` `/userinfo` `/serverinfo` `/avatar` `/dashboard`'
        },
        {
          name: '🎫 Tickets (avancé, optionnel)',
          value:
            '`/ticket create` — crée ET publie un panel en une seule commande\n`/ticket addtype` `/ticket post` `/ticket delete` `/ticket list`'
        },
        {
          name: '⚙️ Configuration avancée (optionnel)',
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
