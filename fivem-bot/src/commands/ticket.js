'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { baseEmbed, successEmbed, errorEmbed, parseColor } = require('../utils/embeds');
const { COLORS } = require('../config/constants');
const { saveAttachment, buildAttachment, attachmentUri } = require('../utils/imageStorage');

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
}

/** Construit le select menu d'ouverture de ticket pour un panel donné. */
function buildSelectRow(panelId, panel, categories) {
  const options = panel.categories
    .map((catId) => {
      const cat = categories[catId];
      if (!cat) return null;
      return { label: cat.name, value: `${panelId}::${catId}`, emoji: cat.emoji || undefined };
    })
    .filter(Boolean);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('ticket_open_select').setPlaceholder('📩 Choisis une catégorie pour ouvrir un ticket').addOptions(options)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Système de tickets — configuration ultra simple.')
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
  const panelId = slugify(name) || `panel-${Date.now()}`;
  if (guildConfig.tickets.panels[panelId]) {
    return interaction.reply({ embeds: [errorEmbed('Un panel avec un nom similaire existe déjà. Choisis un autre nom.')], ephemeral: true });
  }

  const salon = interaction.options.getChannel('salon_publication');
  const roleStaff = interaction.options.getRole('role_staff');
  const image = interaction.options.getAttachment('image');

  await interaction.deferReply({ ephemeral: true });

  // Un panel = un type de ticket par défaut (identifiant = même que le panel). On peut en ajouter
  // d'autres ensuite avec /ticket addtype si besoin — mais ce n'est jamais obligatoire.
  const catId = panelId;
  guildConfig.tickets.categories[catId] = {
    name: name,
    emoji: '🎫',
    categoryChannelId: null,
    staffRoleIds: [roleStaff.id],
    transcriptChannelId: interaction.options.getChannel('salon_transcript')?.id || null,
    dmTranscript: interaction.options.getBoolean('dm_transcript') || false,
    ticketLimit: interaction.options.getInteger('limite') || 1,
    welcomeMessage: null
  };

  guildConfig.tickets.panels[panelId] = {
    name,
    title: interaction.options.getString('titre') || `🎫 ${name}`,
    description: interaction.options.getString('description') || 'Clique sur le menu ci-dessous pour ouvrir un ticket.',
    color: interaction.options.getString('couleur') || '#5865F2',
    categories: [catId],
    channelId: null,
    messageId: null,
    imageFile: null
  };

  if (image) {
    try {
      guildConfig.tickets.panels[panelId].imageFile = await saveAttachment(image, `panel-${panelId}`);
    } catch {
      return interaction.editReply({ embeds: [errorEmbed('Impossible de télécharger cette image, le panel n\'a pas été créé.')] });
    }
  }

  db.save();

  const result = await postPanel(interaction.guild, guildConfig, panelId, salon);
  if (!result.ok) {
    return interaction.editReply({ embeds: [errorEmbed(result.error)] });
  }
  db.save();

  return interaction.editReply({
    embeds: [successEmbed(`Panel **${name}** créé et publié dans ${salon}.\nAstuce : utilise \`/ticket addtype\` si tu veux ajouter d'autres catégories à ce panel.`)]
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

  // Met à jour automatiquement le message publié si possible
  if (panel.channelId && panel.messageId) {
    const channel = interaction.guild.channels.cache.get(panel.channelId);
    if (channel) {
      const message = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (message) {
        await message.edit({ components: [buildSelectRow(panelId, panel, guildConfig.tickets.categories)] }).catch(() => null);
      }
    }
  }

  return interaction.reply({ embeds: [successEmbed(`Type **${name}** ajouté au panel **${panel.name}**.`)], ephemeral: true });
}

async function postPanel(guild, guildConfig, panelId, channel) {
  const panel = guildConfig.tickets.panels[panelId];
  if (!panel.categories || panel.categories.length === 0) {
    return { ok: false, error: 'Ce panel n\'a aucun type de ticket.' };
  }

  const embed = baseEmbed(parseColor(panel.color)).setTitle(panel.title).setDescription(panel.description);
  const files = [];
  const attachment = buildAttachment(panel.imageFile);
  if (attachment) {
    embed.setImage(attachmentUri(panel.imageFile));
    files.push(attachment);
  }

  const row = buildSelectRow(panelId, panel, guildConfig.tickets.categories);

  try {
    const message = await channel.send({ embeds: [embed], components: [row], files });
    panel.channelId = channel.id;
    panel.messageId = message.id;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Impossible de publier le panel (vérifie mes permissions dans ce salon).' };
  }
}

async function handlePost(interaction, guildConfig, db) {
  const panelName = interaction.options.getString('panel');
  const channel = interaction.options.getChannel('salon');
  const panelEntry = Object.entries(guildConfig.tickets.panels).find(([, p]) => p.name === panelName);
  if (!panelEntry) return interaction.reply({ embeds: [errorEmbed('Panel introuvable.')], ephemeral: true });
  const [panelId] = panelEntry;

  await interaction.deferReply({ ephemeral: true });
  const result = await postPanel(interaction.guild, guildConfig, panelId, channel);
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
  if (panels.length === 0) return interaction.reply({ embeds: [errorEmbed('Aucun panel créé. Utilise `/ticket create` pour commencer.')], ephemeral: true });
  const embed = baseEmbed(COLORS.PRIMARY)
    .setTitle('📋 Panels de tickets')
    .setDescription(
      panels
        .map((p) => `**${p.name}** — ${p.categories.length} type(s) — ${p.channelId ? `publié dans <#${p.channelId}>` : 'non publié'}`)
        .join('\n')
    );
  return interaction.reply({ embeds: [embed], ephemeral: true });
}
