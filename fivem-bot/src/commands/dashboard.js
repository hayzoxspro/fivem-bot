'use strict';

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { COLORS } = require('../config/constants');

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${days}j ${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
  data: new SlashCommandBuilder().setName('dashboard').setDescription('Affiche le tableau de bord du bot.'),
  async execute(interaction) {
    const client = interaction.client;
    const guildConfig = client.db.getGuild(interaction.guild.id);

    const openTickets = Object.keys(guildConfig.tickets.open).length;
    const totalTickets = guildConfig.tickets.counter;
    const memoryMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('📊 Dashboard — Gang Manager')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: '🟢 Statut', value: 'En ligne', inline: true },
        { name: '📶 Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
        { name: '⏱️ Uptime', value: formatUptime(client.uptime), inline: true },
        { name: '👥 Membres', value: `${interaction.guild.memberCount}`, inline: true },
        { name: '🎫 Tickets ouverts', value: `${openTickets}`, inline: true },
        { name: '📁 Tickets créés (total)', value: `${totalTickets}`, inline: true },
        { name: '💾 Mémoire utilisée', value: `${memoryMb} MB`, inline: true },
        { name: '🖥️ Serveurs', value: `${client.guilds.cache.size}`, inline: true },
        { name: '📦 Version', value: 'v1.0.0', inline: true }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dashboard_refresh').setLabel('Actualiser').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
