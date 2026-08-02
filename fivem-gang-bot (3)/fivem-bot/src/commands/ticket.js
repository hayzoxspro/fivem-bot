'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { baseEmbed, successEmbed, errorEmbed } = require('../utils/embeds');
const { COLORS } = require('../config/constants');
const { saveAttachment } = require('../utils/imageStorage');
const { slugify, buildOpenComponents, createSimplePanel, postPanelMessage } = require('../services/panelBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Commande avancée pour les tickets. Pour un réglage rapide, utilise plutôt /setup.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Créer et publier un panel de tickets en une seule commande')
        .addStringOption((o) => o.setName('nom').setDescription('Nom du panel (interne)').setRequired(true))
        .addChannelOption((o) => o.setName('salon_publication').setDescription('Salon où publier le panel').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption((o) => o.setName('role_staff').setDescription('Rôle staff qui gère les tickets').setRequired(true))
        .addStringOption((o) => o.setName('titre').setDescription('Titre de l\'embed').setRequired(false))
        .addStringOption((o) => o.setName('description').setDescription('Description de l\'embed').setRequired(false))
        .addChannelOption((o) => o.setName('salon_transcript').setDescription('Salon où envoyer les transcripts').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addBooleanOption((o) => o.setName('dm_transcript').setDescription('Envoyer aussi le transcript en DM au créateur').setRequired(false))
        .addIntegerOption((o) => o.setName('limite').setDescription('Nombre de tickets ouverts max par membre (défaut: 1)').setMinValue(1).setMaxValue(10).setRequired(false))
        .addStringOption((o) => o.setName('couleur').setDescription('Couleur hex, ex: #5865F2').setRequired(false))
        .addAttachmentOption((o) => o.setName('image').setDescription('Image à joindre à l\'embed (upload direct)').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('addtype')
        .setDescription('Ajouter un type de ticket supplémentaire à un panel existant')
        .addStringOption((o) => o.setName('panel').setDescription('Nom du panel').setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName('nom').setDescription('Nom du type de ticket (ex: Recrutement)').setRequired(true))
        .addRoleOption((o) => o.setName('role_staff').setDescription('Rôle staff qui gère ce type').setRequired(true))
        .addStringOption((o) => o.setName('emoji').setDescription('Emoji affiché').setRequired(false))
        .addChannelOption((o) => o.setName('salon_transcript').setDescription('Salon où envoyer les transcripts').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addIntegerOption((o) => o.setName('limite').setDescription('Nombre de tickets ouverts max par membre').setMinValue(1).setMaxValue(10).setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('post')
        .setDescription('(Re)publier un panel existant dans un salon')
        .addStringOption((o) => o.setName('panel').setDescription('Nom du panel').setRequired(true).setAutocomplete(true))
        .addChannelOption((o) => o.setName('salon').setDescription('Salon de publication').addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('delete')
        .setDescription('Supprimer un panel de tickets')
        .addStringOption((o) => o.setName('panel').setDescription('Nom du panel').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((s) => s.setName('list').setDescription('Lister les panels de tickets existants')),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const guildConfig = interaction.client.db.getGuild(interaction.guild.id);
    let choices = [];
    if (focused.name === 'panel') {
      choices = Object.values(guildConfig.tickets.panels).map((p) => p.name);
    }
    const filtered = choices.filter((c) => c.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25);
    await interaction.respond(filtered.map((c) => ({ name: c, value: c })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = interaction.client.db;
    const guildConfig = db.getGuild(interaction.guild.id);

    if (sub === 'create') return handleCreate(interaction, guildConfig, db);
    if (sub === 'addtype') return handleAddType(interaction, guildConfig, db);
    if (sub === 'post') return handlePost(interaction, guildConfig, db);
    if (sub === 'delete') return handleDelete(interaction, guildConfig, db);
    if (sub === 'list') return handleList(interaction, guildConfig);
  }
};

async function handleCreate(interaction, guildConfig, db) {
  const name = interaction.options.getString('nom');
  if (Object.values(guildConfig.tickets.panels).some((p) => p.name === name)) {
    return interaction.reply({ embeds: [errorEmbed('Un panel avec un nom similaire existe déjà. Choisis un autre nom.')], ephemeral: true });
  }

  const salon = interaction.options.getChannel('salon_publication');
  const roleStaff = interaction.options.getRole('role_staff');
  const image = interaction.options.getAttachment('image');

  await interaction.deferReply({ ephemeral: true });

  let imageFile = null;
  if (image) {
    try {
      imageFile = await saveAttachment(image, 'panel');
    } catch {
      return interaction.editReply({ embeds: [errorEmbed('Impossible de télécharger cette image, le panel n\'a pas été créé.')] });
    }
  }

  const panelId = createSimplePanel(guildConfig, {
    name,
    roleId: roleStaff.id,
    transcriptChannelId: interaction.options.getChannel('salon_transcript')?.id || null,
    dmTranscript: interaction.options.getBoolean('dm_transcript') || false,
    limit: interaction.options.getInteger('limite') || 1,
    title: interaction.options.getString('titre'),
    description: interaction.options.getString('description'),
    color: interaction.options.getString('couleur') || '#5865F2',
    imageFile
  });
  db.save();

  const result = await postPanelMessage(interaction.guild, guildConfig, panelId, salon);
  if (!result.ok) return interaction.editReply({ embeds: [errorEmbed(result.error)] });
  db.save();

  return interaction.editReply({
    embeds: [successEmbed(`Panel **${name}** créé et publié dans ${salon}.\nAstuce : \`/ticket addtype\` pour ajouter d'autres catégories si besoin.`)]
  });
}

async function handleAddType(interaction, guildConfig, db) {
  const panelName = interaction.options.getString('panel');
  const panelEntry = Object.entries(guildConfig.tickets.panels).find(([, p]) => p.name === panelName);
  if (!panelEntry) return interaction.reply({ embeds: [errorEmbed('Panel introuvable.')], ephemeral: true });
  const [panelId, panel] = panelEntry;

  const name = interaction.options.getString('nom');
  const catId = `${panelId}-${slugify(name) || Date.now()}`;
  const roleStaff = interaction.options.getRole('role_staff');

  guildConfig.tickets.categories[catId] = {
    name,
    emoji: interaction.options.getString('emoji') || '🎫',
    categoryChannelId: null,
    staffRoleIds: [roleStaff.id],
    transcriptChannelId: interaction.options.getChannel('salon_transcript')?.id || null,
    dmTranscript: false,
    ticketLimit: interaction.options.getInteger('limite') || 1,
    welcomeMessage: null
  };
  panel.categories.push(catId);
  db.save();

  if (panel.channelId && panel.messageId) {
    const channel = interaction.guild.channels.cache.get(panel.channelId);
    if (channel) {
      const message = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (message) {
        await message.edit({ components: buildOpenComponents(panelId, panel, guildConfig.tickets.categories) }).catch(() => null);
      }
    }
  }

  return interaction.reply({ embeds: [successEmbed(`Type **${name}** ajouté au panel **${panel.name}**.`)], ephemeral: true });
}

async function handlePost(interaction, guildConfig, db) {
  const panelName = interaction.options.getString('panel');
  const channel = interaction.options.getChannel('salon');
  const panelEntry = Object.entries(guildConfig.tickets.panels).find(([, p]) => p.name === panelName);
  if (!panelEntry) return interaction.reply({ embeds: [errorEmbed('Panel introuvable.')], ephemeral: true });
  const [panelId] = panelEntry;

  await interaction.deferReply({ ephemeral: true });
  const result = await postPanelMessage(interaction.guild, guildConfig, panelId, channel);
  db.save();
  if (!result.ok) return interaction.editReply({ embeds: [errorEmbed(result.error)] });
  return interaction.editReply({ embeds: [successEmbed(`Panel publié dans ${channel}.`)] });
}

async function handleDelete(interaction, guildConfig, db) {
  const panelName = interaction.options.getString('panel');
  const panelEntry = Object.entries(guildConfig.tickets.panels).find(([, p]) => p.name === panelName);
  if (!panelEntry) return interaction.reply({ embeds: [errorEmbed('Panel introuvable.')], ephemeral: true });
  const [panelId, panel] = panelEntry;

  if (panel.channelId && panel.messageId) {
    const channel = interaction.guild.channels.cache.get(panel.channelId);
    if (channel) {
      const message = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (message) await message.delete().catch(() => null);
    }
  }

  for (const catId of panel.categories) delete guildConfig.tickets.categories[catId];
  delete guildConfig.tickets.panels[panelId];
  db.save();

  return interaction.reply({ embeds: [successEmbed(`Panel **${panelName}** supprimé.`)], ephemeral: true });
}

async function handleList(interaction, guildConfig) {
  const panels = Object.values(guildConfig.tickets.panels);
  if (panels.length === 0) return interaction.reply({ embeds: [errorEmbed('Aucun panel créé. Utilise `/setup` pour commencer simplement.')], ephemeral: true });
  const embed = baseEmbed(COLORS.PRIMARY)
    .setTitle('📋 Panels de tickets')
    .setDescription(panels.map((p) => `**${p.name}** — ${p.categories.length} type(s) — ${p.channelId ? `publié dans <#${p.channelId}>` : 'non publié'}`).join('\n'));
  return interaction.reply({ embeds: [embed], ephemeral: true });
}
