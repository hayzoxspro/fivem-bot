'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { baseEmbed, successEmbed, errorEmbed, parseColor } = require('../utils/embeds');
const { COLORS, EMOJIS } = require('../config/constants');

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gère le système de tickets.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((group) =>
      group
        .setName('category')
        .setDescription('Gérer les catégories de tickets')
        .addSubcommand((sub) =>
          sub
            .setName('create')
            .setDescription('Créer une catégorie de ticket')
            .addStringOption((o) => o.setName('nom').setDescription('Nom de la catégorie').setRequired(true))
            .addStringOption((o) => o.setName('emoji').setDescription('Emoji affiché').setRequired(false))
            .addChannelOption((o) =>
              o.setName('categorie_discord').setDescription('Catégorie Discord où créer les salons').addChannelTypes(ChannelType.GuildCategory).setRequired(false)
            )
            .addRoleOption((o) => o.setName('role_staff').setDescription('Rôle staff avec accès').setRequired(false))
            .addChannelOption((o) =>
              o.setName('salon_transcript').setDescription('Salon où envoyer les transcripts').addChannelTypes(ChannelType.GuildText).setRequired(false)
            )
            .addBooleanOption((o) => o.setName('dm_transcript').setDescription('Envoyer le transcript en DM au créateur').setRequired(false))
            .addIntegerOption((o) => o.setName('limite').setDescription('Nombre max de tickets ouverts simultanément par membre').setMinValue(1).setMaxValue(10).setRequired(false))
            .addStringOption((o) => o.setName('message_bienvenue').setDescription('Message affiché à l\'ouverture du ticket').setRequired(false))
        )
        .addSubcommand((sub) =>
          sub
            .setName('addstaffrole')
            .setDescription('Ajouter un rôle staff à une catégorie')
            .addStringOption((o) => o.setName('categorie').setDescription('Nom de la catégorie').setRequired(true).setAutocomplete(true))
            .addRoleOption((o) => o.setName('role').setDescription('Rôle à ajouter').setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('delete')
            .setDescription('Supprimer une catégorie de ticket')
            .addStringOption((o) => o.setName('categorie').setDescription('Nom de la catégorie').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand((sub) => sub.setName('list').setDescription('Lister les catégories de tickets'))
    )
    .addSubcommandGroup((group) =>
      group
        .setName('panel')
        .setDescription('Gérer les panels de tickets')
        .addSubcommand((sub) =>
          sub
            .setName('create')
            .setDescription('Créer un panel de tickets')
            .addStringOption((o) => o.setName('nom').setDescription('Nom interne du panel').setRequired(true))
            .addStringOption((o) => o.setName('titre').setDescription('Titre de l\'embed').setRequired(true))
            .addStringOption((o) => o.setName('description').setDescription('Description de l\'embed').setRequired(true))
            .addStringOption((o) => o.setName('couleur').setDescription('Couleur hex, ex: #5865F2').setRequired(false))
        )
        .addSubcommand((sub) =>
          sub
            .setName('addcategory')
            .setDescription('Ajouter une catégorie de ticket à un panel')
            .addStringOption((o) => o.setName('panel').setDescription('Nom du panel').setRequired(true).setAutocomplete(true))
            .addStringOption((o) => o.setName('categorie').setDescription('Nom de la catégorie').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('post')
            .setDescription('Publier un panel dans un salon')
            .addStringOption((o) => o.setName('panel').setDescription('Nom du panel').setRequired(true).setAutocomplete(true))
            .addChannelOption((o) => o.setName('salon').setDescription('Salon de publication').addChannelTypes(ChannelType.GuildText).setRequired(true))
        )
        .addSubcommand((sub) =>
          sub
            .setName('delete')
            .setDescription('Supprimer un panel')
            .addStringOption((o) => o.setName('panel').setDescription('Nom du panel').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand((sub) => sub.setName('list').setDescription('Lister les panels'))
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const guildConfig = interaction.client.db.getGuild(interaction.guild.id);
    let choices = [];
    if (focused.name === 'categorie') {
      choices = Object.values(guildConfig.tickets.categories).map((c) => c.name);
    } else if (focused.name === 'panel') {
      choices = Object.values(guildConfig.tickets.panels).map((p) => p.name);
    }
    const filtered = choices.filter((c) => c.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25);
    await interaction.respond(filtered.map((c) => ({ name: c, value: c })));
  },

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const db = interaction.client.db;
    const guildConfig = db.getGuild(interaction.guild.id);

    if (group === 'category') return handleCategory(interaction, guildConfig, db, sub);
    if (group === 'panel') return handlePanel(interaction, guildConfig, db, sub);
  }
};

async function handleCategory(interaction, guildConfig, db, sub) {
  if (sub === 'create') {
    const name = interaction.options.getString('nom');
    const id = slugify(name) || `cat-${Date.now()}`;
    if (guildConfig.tickets.categories[id]) {
      return interaction.reply({ embeds: [errorEmbed('Une catégorie avec un nom similaire existe déjà.')], ephemeral: true });
    }
    const staffRole = interaction.options.getRole('role_staff');
    guildConfig.tickets.categories[id] = {
      name,
      emoji: interaction.options.getString('emoji') || '🎫',
      categoryChannelId: interaction.options.getChannel('categorie_discord')?.id || null,
      staffRoleIds: staffRole ? [staffRole.id] : [],
      transcriptChannelId: interaction.options.getChannel('salon_transcript')?.id || null,
      dmTranscript: interaction.options.getBoolean('dm_transcript') || false,
      ticketLimit: interaction.options.getInteger('limite') || 1,
      welcomeMessage: interaction.options.getString('message_bienvenue') || null
    };
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Catégorie **${name}** créée avec l'identifiant \`${id}\`.`)], ephemeral: true });
  }

  if (sub === 'addstaffrole') {
    const catName = interaction.options.getString('categorie');
    const role = interaction.options.getRole('role');
    const entry = Object.entries(guildConfig.tickets.categories).find(([, c]) => c.name === catName);
    if (!entry) return interaction.reply({ embeds: [errorEmbed('Catégorie introuvable.')], ephemeral: true });
    const [, cat] = entry;
    if (!cat.staffRoleIds.includes(role.id)) cat.staffRoleIds.push(role.id);
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Rôle ${role} ajouté à la catégorie **${cat.name}**.`)], ephemeral: true });
  }

  if (sub === 'delete') {
    const catName = interaction.options.getString('categorie');
    const entry = Object.entries(guildConfig.tickets.categories).find(([, c]) => c.name === catName);
    if (!entry) return interaction.reply({ embeds: [errorEmbed('Catégorie introuvable.')], ephemeral: true });
    delete guildConfig.tickets.categories[entry[0]];
    for (const panel of Object.values(guildConfig.tickets.panels)) {
      panel.categories = panel.categories.filter((id) => id !== entry[0]);
    }
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Catégorie **${catName}** supprimée.`)], ephemeral: true });
  }

  if (sub === 'list') {
    const cats = Object.values(guildConfig.tickets.categories);
    if (cats.length === 0) return interaction.reply({ embeds: [errorEmbed('Aucune catégorie créée.')], ephemeral: true });
    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('🎫 Catégories de tickets')
      .setDescription(
        cats
          .map(
            (c) =>
              `${c.emoji} **${c.name}** — limite: ${c.ticketLimit} | rôles staff: ${c.staffRoleIds.map((r) => `<@&${r}>`).join(', ') || 'aucun'}`
          )
          .join('\n')
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handlePanel(interaction, guildConfig, db, sub) {
  if (sub === 'create') {
    const name = interaction.options.getString('nom');
    const id = slugify(name) || `panel-${Date.now()}`;
    if (guildConfig.tickets.panels[id]) {
      return interaction.reply({ embeds: [errorEmbed('Un panel avec un nom similaire existe déjà.')], ephemeral: true });
    }
    guildConfig.tickets.panels[id] = {
      name,
      title: interaction.options.getString('titre'),
      description: interaction.options.getString('description'),
      color: interaction.options.getString('couleur') || '#5865F2',
      categories: [],
      channelId: null,
      messageId: null
    };
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Panel **${name}** créé. Ajoute des catégories avec \`/ticket panel addcategory\`.`)], ephemeral: true });
  }

  if (sub === 'addcategory') {
    const panelName = interaction.options.getString('panel');
    const catName = interaction.options.getString('categorie');
    const panelEntry = Object.entries(guildConfig.tickets.panels).find(([, p]) => p.name === panelName);
    const catEntry = Object.entries(guildConfig.tickets.categories).find(([, c]) => c.name === catName);
    if (!panelEntry) return interaction.reply({ embeds: [errorEmbed('Panel introuvable.')], ephemeral: true });
    if (!catEntry) return interaction.reply({ embeds: [errorEmbed('Catégorie introuvable.')], ephemeral: true });
    const [panelId, panel] = panelEntry;
    const [catId] = catEntry;
    if (!panel.categories.includes(catId)) panel.categories.push(catId);
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Catégorie **${catName}** ajoutée au panel **${panel.name}**.`)], ephemeral: true });
  }

  if (sub === 'post') {
    const panelName = interaction.options.getString('panel');
    const channel = interaction.options.getChannel('salon');
    const panelEntry = Object.entries(guildConfig.tickets.panels).find(([, p]) => p.name === panelName);
    if (!panelEntry) return interaction.reply({ embeds: [errorEmbed('Panel introuvable.')], ephemeral: true });
    const [panelId, panel] = panelEntry;
    if (!panel.categories || panel.categories.length === 0) {
      return interaction.reply({ embeds: [errorEmbed('Ce panel n\'a aucune catégorie. Utilise `/ticket panel addcategory` d\'abord.')], ephemeral: true });
    }

    const embed = baseEmbed(parseColor(panel.color)).setTitle(panel.title).setDescription(panel.description);

    const options = panel.categories
      .map((catId) => {
        const cat = guildConfig.tickets.categories[catId];
        if (!cat) return null;
        return { label: cat.name, value: `${panelId}::${catId}`, emoji: cat.emoji || undefined };
      })
      .filter(Boolean);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_open_select')
        .setPlaceholder('📩 Choisis une catégorie pour ouvrir un ticket')
        .addOptions(options)
    );

    const message = await channel.send({ embeds: [embed], components: [row] });
    panel.channelId = channel.id;
    panel.messageId = message.id;
    db.save();

    return interaction.reply({ embeds: [successEmbed(`Panel publié dans ${channel}.`)], ephemeral: true });
  }

  if (sub === 'delete') {
    const panelName = interaction.options.getString('panel');
    const panelEntry = Object.entries(guildConfig.tickets.panels).find(([, p]) => p.name === panelName);
    if (!panelEntry) return interaction.reply({ embeds: [errorEmbed('Panel introuvable.')], ephemeral: true });
    delete guildConfig.tickets.panels[panelEntry[0]];
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Panel **${panelName}** supprimé (le message publié doit être retiré manuellement si besoin).`)], ephemeral: true });
  }

  if (sub === 'list') {
    const panels = Object.values(guildConfig.tickets.panels);
    if (panels.length === 0) return interaction.reply({ embeds: [errorEmbed('Aucun panel créé.')], ephemeral: true });
    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('📋 Panels de tickets')
      .setDescription(panels.map((p) => `**${p.name}** — ${p.categories.length} catégorie(s) — ${p.channelId ? `publié dans <#${p.channelId}>` : 'non publié'}`).join('\n'));
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
