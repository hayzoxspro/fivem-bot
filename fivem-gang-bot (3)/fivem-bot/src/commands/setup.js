'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  ChannelType
} = require('discord.js');
const { baseEmbed, successEmbed, errorEmbed } = require('../utils/embeds');
const { COLORS } = require('../config/constants');
const setupState = require('../services/setupState');
const { createSimplePanel, postPanelMessage } = require('../services/panelBuilder');

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------
function mainMenuPayload() {
  const embed = baseEmbed(COLORS.PRIMARY)
    .setTitle('🛠️ Assistant de configuration')
    .setDescription(
      'Choisis ce que tu veux configurer. Tu n\'as rien à taper : tu cliques, tu choisis un salon ou un rôle dans le menu, c\'est tout.'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_ticket').setLabel('Tickets').setEmoji('🎫').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup_welcome').setLabel('Arrivée').setEmoji('👋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('setup_convocation').setLabel('Convocation').setEmoji('📢').setStyle(ButtonStyle.Primary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_status').setLabel('Voir mes réglages').setEmoji('📋').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row, row2] };
}

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('setup_back').setLabel('Retour au menu').setEmoji('◀️').setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Assistant de configuration simple — tu cliques, tu ne tapes rien.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    setupState.clear(interaction.user.id);
    await interaction.reply({ ...mainMenuPayload(), ephemeral: true });
  },

  mainMenuPayload,
  backRow,

  // -------------------------------------------------------------------------
  // 🎫 TICKETS — 2 clics : salon puis rôle staff
  // -------------------------------------------------------------------------
  async ticketStart(interaction) {
    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('🎫 Tickets — Étape 1/2')
      .setDescription('Choisis le salon où le bouton "Ouvrir un ticket" sera publié.');
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('setup_ticket_channel').setPlaceholder('Choisis un salon').addChannelTypes(ChannelType.GuildText)
    );
    await interaction.update({ embeds: [embed], components: [row, backRow()] });
  },

  async ticketChannelChosen(interaction) {
    const channelId = interaction.values[0];
    setupState.set(interaction.user.id, { ticketChannelId: channelId });

    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('🎫 Tickets — Étape 2/2')
      .setDescription('Choisis le rôle staff qui pourra voir et gérer les tickets.');
    const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup_ticket_role').setPlaceholder('Choisis un rôle'));
    await interaction.update({ embeds: [embed], components: [row, backRow()] });
  },

  async ticketRoleChosen(interaction) {
    const roleId = interaction.values[0];
    const { ticketChannelId } = setupState.get(interaction.user.id);
    const channel = interaction.guild.channels.cache.get(ticketChannelId);
    if (!channel) {
      return interaction.update({ embeds: [errorEmbed('Le salon choisi n\'existe plus, relance /setup.')], components: [backRow()] });
    }

    const db = interaction.client.db;
    const guildConfig = db.getGuild(interaction.guild.id);

    // On réutilise (écrase) toujours le même panel "support" pour que relancer /setup ne crée pas de doublons.
    delete guildConfig.tickets.panels.support;
    delete guildConfig.tickets.categories.support;

    const panelId = createSimplePanel(guildConfig, {
      name: 'Support',
      roleId,
      dmTranscript: true
    });
    db.save();

    const result = await postPanelMessage(interaction.guild, guildConfig, panelId, channel);
    db.save();
    setupState.clear(interaction.user.id);

    const embed = successEmbed(
      result.ok
        ? `Le système de tickets est prêt dans ${channel} ! Les membres peuvent déjà cliquer pour ouvrir un ticket.\n\n💡 Le transcript sera envoyé en message privé au membre à la fermeture. Pour aussi l'envoyer dans un salon, ou ajouter plusieurs catégories, utilise la commande avancée \`/ticket create\`.`
        : `Panel créé mais je n'ai pas pu le publier dans ${channel} (vérifie mes permissions : Voir le salon, Envoyer des messages). Utilise \`/ticket post\` pour réessayer.`,
      'Tickets configurés'
    );
    await interaction.update({ embeds: [embed], components: [backRow()] });
  },

  // -------------------------------------------------------------------------
  // 👋 ARRIVÉE — 1 clic : salon
  // -------------------------------------------------------------------------
  async welcomeStart(interaction) {
    const embed = baseEmbed(COLORS.PRIMARY).setTitle('👋 Message d\'arrivée').setDescription('Choisis le salon où annoncer les arrivées.');
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('setup_welcome_channel').setPlaceholder('Choisis un salon').addChannelTypes(ChannelType.GuildText)
    );
    await interaction.update({ embeds: [embed], components: [row, backRow()] });
  },

  async welcomeChannelChosen(interaction) {
    const channelId = interaction.values[0];
    const db = interaction.client.db;
    const guildConfig = db.getGuild(interaction.guild.id);
    guildConfig.welcome.enabled = true;
    guildConfig.welcome.channelId = channelId;
    db.save();

    const embed = successEmbed(
      `Message d'arrivée activé dans <#${channelId}> !\n\n💡 Pour changer le texte ou ajouter une image, utilise la commande avancée \`/config welcome set\`.`,
      'Arrivée configurée'
    );
    await interaction.update({ embeds: [embed], components: [backRow()] });
  },

  // -------------------------------------------------------------------------
  // 📢 CONVOCATION — 3 clics : salon, heure, rôle (ou passer)
  // -------------------------------------------------------------------------
  async convocationStart(interaction) {
    const embed = baseEmbed(COLORS.PRIMARY).setTitle('📢 Convocation — Étape 1/3').setDescription('Choisis le salon où envoyer la convocation chaque jour.');
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId('setup_convocation_channel').setPlaceholder('Choisis un salon').addChannelTypes(ChannelType.GuildText)
    );
    await interaction.update({ embeds: [embed], components: [row, backRow()] });
  },

  async convocationChannelChosen(interaction) {
    const channelId = interaction.values[0];
    setupState.set(interaction.user.id, { convocationChannelId: channelId });

    const embed = baseEmbed(COLORS.PRIMARY).setTitle('📢 Convocation — Étape 2/3').setDescription('Choisis l\'heure d\'envoi (tous les jours).');
    const times = ['18:00', '19:00', '20:00', '20:30', '21:00', '21:30', '22:00', '23:00'];
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_convocation_time')
        .setPlaceholder('Choisis une heure')
        .addOptions(times.map((t) => ({ label: `${t}`, value: t })))
    );
    await interaction.update({ embeds: [embed], components: [row, backRow()] });
  },

  async convocationTimeChosen(interaction) {
    const [hour, minute] = interaction.values[0].split(':').map(Number);
    setupState.set(interaction.user.id, { convocationHour: hour, convocationMinute: minute });

    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('📢 Convocation — Étape 3/3')
      .setDescription('Choisis un rôle à mentionner (optionnel), ou clique sur "Passer".');
    const row = new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('setup_convocation_role').setPlaceholder('Choisis un rôle (optionnel)'));
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup_convocation_skip').setLabel('Passer cette étape').setStyle(ButtonStyle.Secondary)
    );
    await interaction.update({ embeds: [embed], components: [row, row2, backRow()] });
  },

  async convocationFinish(interaction, roleId) {
    const { convocationChannelId, convocationHour, convocationMinute } = setupState.get(interaction.user.id);
    const db = interaction.client.db;
    const guildConfig = db.getGuild(interaction.guild.id);
    guildConfig.convocation.enabled = true;
    guildConfig.convocation.channelId = convocationChannelId;
    guildConfig.convocation.hour = convocationHour;
    guildConfig.convocation.minute = convocationMinute;
    guildConfig.convocation.roleId = roleId || null;
    db.save();
    setupState.clear(interaction.user.id);

    const heureStr = `${String(convocationHour).padStart(2, '0')}h${String(convocationMinute).padStart(2, '0')}`;
    const embed = successEmbed(
      `Convocation activée dans <#${convocationChannelId}> chaque jour à **${heureStr}**${roleId ? ` (avec mention de <@&${roleId}>)` : ''} !\n\n💡 Pour ajouter une image, utilise la commande avancée \`/config convocation set\`.`,
      'Convocation configurée'
    );
    await interaction.update({ embeds: [embed], components: [backRow()] });
  },

  // -------------------------------------------------------------------------
  // 📋 STATUT
  // -------------------------------------------------------------------------
  async status(interaction) {
    const guildConfig = interaction.client.db.getGuild(interaction.guild.id);
    const panelCount = Object.keys(guildConfig.tickets.panels).length;
    const conv = guildConfig.convocation;

    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('📋 Tes réglages actuels')
      .addFields(
        { name: '🎫 Tickets', value: panelCount > 0 ? `${panelCount} panel(s) configuré(s)` : 'Non configuré' },
        { name: '👋 Arrivée', value: guildConfig.welcome.enabled ? `Activé dans <#${guildConfig.welcome.channelId}>` : 'Non configuré' },
        {
          name: '📢 Convocation',
          value: conv.enabled ? `Activée dans <#${conv.channelId}> à ${String(conv.hour).padStart(2, '0')}h${String(conv.minute).padStart(2, '0')}` : 'Non configuré'
        }
      );
    await interaction.update({ embeds: [embed], components: [backRow()] });
  }
};
