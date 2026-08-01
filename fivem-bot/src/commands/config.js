'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { baseEmbed, successEmbed, errorEmbed, parseColor, applyPlaceholders } = require('../utils/embeds');
const { COLORS, LOG_TYPES } = require('../config/constants');
const { saveAttachment, deleteImage, buildAttachment, attachmentUri } = require('../utils/imageStorage');

const logChoices = Object.entries(LOG_TYPES).map(([key, meta]) => ({ name: `${meta.emoji} ${meta.label}`, value: key }));
const permissionTargets = [
  { name: 'Ouvrir un ticket', value: 'ticketOpenRoleIds' },
  { name: 'Fermer/gérer un ticket', value: 'ticketCloseRoleIds' },
  { name: 'Voir les logs (commande)', value: 'logsViewRoleIds' }
];

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
    .setName('config')
    .setDescription('Configure le bot entièrement depuis Discord.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((g) =>
      g
        .setName('welcome')
        .setDescription('Message d\'arrivée')
        .addSubcommand((s) =>
          s
            .setName('set')
            .setDescription('Configurer le message d\'arrivée')
            .addBooleanOption((o) => o.setName('active').setDescription('Activer/désactiver').setRequired(false))
            .addChannelOption((o) => o.setName('salon').setDescription('Salon d\'annonce').addChannelTypes(ChannelType.GuildText).setRequired(false))
            .addStringOption((o) => o.setName('titre').setDescription('Titre (variables: {user} {username} {server} {members})').setRequired(false))
            .addStringOption((o) => o.setName('description').setDescription('Description (mêmes variables)').setRequired(false))
            .addStringOption((o) => o.setName('couleur').setDescription('Couleur hex, ex: #2ecc71').setRequired(false))
            .addAttachmentOption((o) => o.setName('image').setDescription('Image à joindre (upload direct, pas de lien)').setRequired(false))
            .addBooleanOption((o) => o.setName('avatar_thumbnail').setDescription('Afficher l\'avatar en miniature').setRequired(false))
            .addStringOption((o) => o.setName('footer').setDescription('Texte du footer').setRequired(false))
        )
        .addSubcommand((s) => s.setName('preview').setDescription('Prévisualiser le message d\'arrivée'))
    )
    .addSubcommandGroup((g) =>
      g
        .setName('leave')
        .setDescription('Message de départ')
        .addSubcommand((s) =>
          s
            .setName('set')
            .setDescription('Configurer le message de départ')
            .addBooleanOption((o) => o.setName('active').setDescription('Activer/désactiver').setRequired(false))
            .addChannelOption((o) => o.setName('salon').setDescription('Salon d\'annonce').addChannelTypes(ChannelType.GuildText).setRequired(false))
            .addStringOption((o) => o.setName('titre').setDescription('Titre').setRequired(false))
            .addStringOption((o) => o.setName('description').setDescription('Description (variables: {username} {server} {members} {duration})').setRequired(false))
            .addStringOption((o) => o.setName('couleur').setDescription('Couleur hex').setRequired(false))
            .addBooleanOption((o) => o.setName('avatar_thumbnail').setDescription('Afficher l\'avatar en miniature').setRequired(false))
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName('logs')
        .setDescription('Salons de logs')
        .addSubcommand((s) =>
          s
            .setName('set')
            .setDescription('Définir le salon pour un type de log')
            .addStringOption((o) => o.setName('type').setDescription('Type de log').setRequired(true).addChoices(...logChoices))
            .addChannelOption((o) => o.setName('salon').setDescription('Salon cible').addChannelTypes(ChannelType.GuildText).setRequired(true))
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Désactiver un type de log')
            .addStringOption((o) => o.setName('type').setDescription('Type de log').setRequired(true).addChoices(...logChoices))
        )
        .addSubcommand((s) => s.setName('list').setDescription('Voir la configuration des logs'))
    )
    .addSubcommandGroup((g) =>
      g
        .setName('convocation')
        .setDescription('Présence / convocation quotidienne automatique')
        .addSubcommand((s) =>
          s
            .setName('set')
            .setDescription('Configurer la convocation quotidienne (envoyée chaque jour à l\'heure choisie)')
            .addChannelOption((o) => o.setName('salon').setDescription('Salon d\'envoi').addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addIntegerOption((o) => o.setName('heure').setDescription('Heure (0-23)').setMinValue(0).setMaxValue(23).setRequired(true))
            .addIntegerOption((o) => o.setName('minute').setDescription('Minute (0-59)').setMinValue(0).setMaxValue(59).setRequired(false))
            .addRoleOption((o) => o.setName('role_a_convoquer').setDescription('Rôle à mentionner/convoquer').setRequired(false))
            .addAttachmentOption((o) => o.setName('image').setDescription('Image à joindre (upload direct, pas de lien)').setRequired(false))
            .addStringOption((o) => o.setName('titre').setDescription('Titre custom (sinon généré automatiquement avec la date)').setRequired(false))
        )
        .addSubcommand((s) => s.setName('off').setDescription('Désactiver la convocation quotidienne'))
        .addSubcommand((s) => s.setName('preview').setDescription('Envoyer un aperçu immédiat dans ce salon'))
        .addSubcommand((s) => s.setName('status').setDescription('Voir la configuration actuelle'))
    )
    .addSubcommandGroup((g) =>
      g
        .setName('autoreact')
        .setDescription('Réactions automatiques')
        .addSubcommand((s) =>
          s
            .setName('bot')
            .setDescription('Le bot réagit automatiquement à ses propres messages dans un salon')
            .addChannelOption((o) => o.setName('salon').setDescription('Salon concerné').addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addStringOption((o) => o.setName('emojis').setDescription('Emojis séparés par des espaces').setRequired(true))
        )
        .addSubcommand((s) =>
          s
            .setName('message')
            .setDescription('Ajouter des réactions à un message précis')
            .addStringOption((o) => o.setName('message_id').setDescription('ID du message').setRequired(true))
            .addChannelOption((o) => o.setName('salon').setDescription('Salon du message').addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addStringOption((o) => o.setName('emojis').setDescription('Emojis séparés par des espaces').setRequired(true))
        )
        .addSubcommand((s) =>
          s.setName('delete').setDescription('Supprimer une config auto-react').addStringOption((o) => o.setName('id').setDescription('Identifiant').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand((s) => s.setName('list').setDescription('Lister les auto-react actifs'))
    )
    .addSubcommandGroup((g) =>
      g
        .setName('permissions')
        .setDescription('Gérer les permissions')
        .addSubcommand((s) =>
          s
            .setName('add')
            .setDescription('Autoriser un rôle pour une action')
            .addStringOption((o) => o.setName('action').setDescription('Action concernée').setRequired(true).addChoices(...permissionTargets))
            .addRoleOption((o) => o.setName('role').setDescription('Rôle à autoriser').setRequired(true))
        )
        .addSubcommand((s) =>
          s
            .setName('remove')
            .setDescription('Retirer un rôle d\'une action')
            .addStringOption((o) => o.setName('action').setDescription('Action concernée').setRequired(true).addChoices(...permissionTargets))
            .addRoleOption((o) => o.setName('role').setDescription('Rôle à retirer').setRequired(true))
        )
        .addSubcommand((s) => s.setName('list').setDescription('Voir les permissions configurées'))
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const guildConfig = interaction.client.db.getGuild(interaction.guild.id);
    let choices = [];
    if (focused.name === 'id' && interaction.options.getSubcommandGroup() === 'autoreact') {
      choices = Object.keys(guildConfig.autoReact);
    }
    const filtered = choices.filter((c) => c.toLowerCase().includes(focused.value.toLowerCase())).slice(0, 25);
    await interaction.respond(filtered.map((c) => ({ name: c, value: c })));
  },

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const db = interaction.client.db;
    const guildConfig = db.getGuild(interaction.guild.id);

    if (group === 'welcome') return handleWelcome(interaction, guildConfig, db, sub);
    if (group === 'leave') return handleLeave(interaction, guildConfig, db, sub);
    if (group === 'logs') return handleLogs(interaction, guildConfig, db, sub);
    if (group === 'convocation') return handleConvocation(interaction, guildConfig, db, sub);
    if (group === 'autoreact') return handleAutoReact(interaction, guildConfig, db, sub);
    if (group === 'permissions') return handlePermissions(interaction, guildConfig, db, sub);
  }
};

async function handleWelcome(interaction, guildConfig, db, sub) {
  if (sub === 'preview') {
    const w = guildConfig.welcome;
    const embed = baseEmbed(parseColor(w.color, COLORS.SUCCESS))
      .setTitle(applyPlaceholders(w.title, interaction.member))
      .setDescription(applyPlaceholders(w.description, interaction.member));
    if (w.thumbnail) embed.setThumbnail(interaction.user.displayAvatarURL());
    if (w.footer) embed.setFooter({ text: w.footer });
    const files = [];
    const attachment = buildAttachment(w.imageFile);
    if (attachment) {
      embed.setImage(attachmentUri(w.imageFile));
      files.push(attachment);
    }
    return interaction.reply({ embeds: [embed], files, ephemeral: true });
  }

  const w = guildConfig.welcome;
  const active = interaction.options.getBoolean('active');
  const salon = interaction.options.getChannel('salon');
  const titre = interaction.options.getString('titre');
  const description = interaction.options.getString('description');
  const couleur = interaction.options.getString('couleur');
  const image = interaction.options.getAttachment('image');
  const thumb = interaction.options.getBoolean('avatar_thumbnail');
  const footer = interaction.options.getString('footer');

  if (active !== null) w.enabled = active;
  if (salon) w.channelId = salon.id;
  if (titre) w.title = titre;
  if (description) w.description = description;
  if (couleur) w.color = couleur;
  if (thumb !== null) w.thumbnail = thumb;
  if (footer !== null) w.footer = footer;

  if (image) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const filename = await saveAttachment(image, 'welcome');
      deleteImage(w.imageFile);
      w.imageFile = filename;
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed('Impossible de télécharger cette image. Réessaie avec un autre fichier.')] });
    }
  }
  db.save();

  const payload = { embeds: [successEmbed(`Configuration du message d'arrivée mise à jour. Statut : **${w.enabled ? 'activé' : 'désactivé'}**.`)] };
  if (interaction.deferred) return interaction.editReply(payload);
  return interaction.reply({ ...payload, ephemeral: true });
}

async function handleLeave(interaction, guildConfig, db, sub) {
  const l = guildConfig.leave;
  const active = interaction.options.getBoolean('active');
  const salon = interaction.options.getChannel('salon');
  const titre = interaction.options.getString('titre');
  const description = interaction.options.getString('description');
  const couleur = interaction.options.getString('couleur');
  const thumb = interaction.options.getBoolean('avatar_thumbnail');

  if (active !== null) l.enabled = active;
  if (salon) l.channelId = salon.id;
  if (titre) l.title = titre;
  if (description) l.description = description;
  if (couleur) l.color = couleur;
  if (thumb !== null) l.thumbnail = thumb;
  db.save();

  return interaction.reply({ embeds: [successEmbed(`Configuration du message de départ mise à jour. Statut : **${l.enabled ? 'activé' : 'désactivé'}**.`)], ephemeral: true });
}

async function handleLogs(interaction, guildConfig, db, sub) {
  if (sub === 'set') {
    const type = interaction.options.getString('type');
    const salon = interaction.options.getChannel('salon');
    guildConfig.logs.channels[type] = salon.id;
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Logs **${LOG_TYPES[type].label}** envoyés dans ${salon}.`)], ephemeral: true });
  }
  if (sub === 'remove') {
    const type = interaction.options.getString('type');
    guildConfig.logs.channels[type] = null;
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Logs **${LOG_TYPES[type].label}** désactivés.`)], ephemeral: true });
  }
  if (sub === 'list') {
    const lines = Object.entries(guildConfig.logs.channels).map(
      ([key, chId]) => `${LOG_TYPES[key].emoji} **${LOG_TYPES[key].label}** — ${chId ? `<#${chId}>` : '*non configuré*'}`
    );
    const embed = baseEmbed(COLORS.PRIMARY).setTitle('📋 Configuration des logs').setDescription(lines.join('\n'));
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

/** Construit l'embed de convocation, identique à celui envoyé automatiquement chaque jour. */
function buildConvocationEmbed(conv) {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = String(now.getFullYear()).slice(-2);
  const heureStr = `${String(conv.hour).padStart(2, '0')}h${conv.minute ? String(conv.minute).padStart(2, '0') : ''}`;
  const title = conv.title || `📢 Présence demandée le ${d}/${m}/${y} à ${heureStr}`;

  const embed = baseEmbed(COLORS.PRIMARY).setTitle(title).setDescription('Présent = ✅\nAbsent = ❌\nRetard = ⏳');
  const files = [];
  const attachment = buildAttachment(conv.imageFile);
  if (attachment) {
    embed.setImage(attachmentUri(conv.imageFile));
    files.push(attachment);
  }
  return { embed, files };
}

async function handleConvocation(interaction, guildConfig, db, sub) {
  const conv = guildConfig.convocation;

  if (sub === 'set') {
    const salon = interaction.options.getChannel('salon');
    const heure = interaction.options.getInteger('heure');
    const minute = interaction.options.getInteger('minute');
    const role = interaction.options.getRole('role_a_convoquer');
    const image = interaction.options.getAttachment('image');
    const titre = interaction.options.getString('titre');

    conv.channelId = salon.id;
    conv.hour = heure;
    conv.minute = minute ?? 0;
    conv.roleId = role ? role.id : conv.roleId;
    conv.title = titre !== null ? titre : conv.title;
    conv.enabled = true;

    if (image) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const filename = await saveAttachment(image, 'convocation');
        deleteImage(conv.imageFile);
        conv.imageFile = filename;
      } catch {
        return interaction.editReply({ embeds: [errorEmbed('Impossible de télécharger cette image. Réessaie avec un autre fichier.')] });
      }
    }
    db.save();

    const payload = {
      embeds: [
        successEmbed(
          `Convocation activée : envoyée chaque jour à **${String(conv.hour).padStart(2, '0')}h${String(conv.minute).padStart(2, '0')}** dans ${salon}${conv.roleId ? ` (avec mention de <@&${conv.roleId}>)` : ''}.`
        )
      ]
    };
    if (interaction.deferred) return interaction.editReply(payload);
    return interaction.reply({ ...payload, ephemeral: true });
  }

  if (sub === 'off') {
    conv.enabled = false;
    db.save();
    return interaction.reply({ embeds: [successEmbed('Convocation quotidienne désactivée.')], ephemeral: true });
  }

  if (sub === 'preview') {
    if (!conv.channelId) return interaction.reply({ embeds: [errorEmbed('Configure d\'abord la convocation avec `/config convocation set`.')], ephemeral: true });
    const { embed, files } = buildConvocationEmbed(conv);
    await interaction.reply({ embeds: [embed], files, ephemeral: true });
    return;
  }

  if (sub === 'status') {
    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('⏰ Convocation quotidienne')
      .setDescription(
        conv.channelId
          ? `**Statut** : ${conv.enabled ? '🟢 activée' : '🔴 désactivée'}\n**Heure** : ${String(conv.hour).padStart(2, '0')}h${String(conv.minute).padStart(2, '0')}\n**Salon** : <#${conv.channelId}>\n**Rôle convoqué** : ${conv.roleId ? `<@&${conv.roleId}>` : 'aucun'}\n**Image** : ${conv.imageFile ? 'oui' : 'aucune'}`
          : 'Aucune convocation configurée. Utilise `/config convocation set`.'
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleAutoReact(interaction, guildConfig, db, sub) {
  if (sub === 'bot') {
    const salon = interaction.options.getChannel('salon');
    const emojis = interaction.options.getString('emojis').split(/\s+/).filter(Boolean);
    const id = `bot-${salon.id}`;
    guildConfig.autoReact[id] = { type: 'bot', channelId: salon.id, messageId: null, emojis, enabled: true };
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Le bot réagira désormais automatiquement à ses messages dans ${salon}.`)], ephemeral: true });
  }
  if (sub === 'message') {
    const messageId = interaction.options.getString('message_id');
    const salon = interaction.options.getChannel('salon');
    const emojis = interaction.options.getString('emojis').split(/\s+/).filter(Boolean);

    try {
      const message = await salon.messages.fetch(messageId);
      for (const emoji of emojis) {
        await message.react(emoji).catch(() => null);
      }
      const id = `msg-${messageId}`;
      guildConfig.autoReact[id] = { type: 'message', channelId: salon.id, messageId, emojis, enabled: true };
      db.save();
      return interaction.reply({ embeds: [successEmbed('Réactions ajoutées au message avec succès.')], ephemeral: true });
    } catch (err) {
      return interaction.reply({ embeds: [errorEmbed('Message introuvable ou emoji invalide.')], ephemeral: true });
    }
  }
  if (sub === 'delete') {
    const id = interaction.options.getString('id');
    if (!guildConfig.autoReact[id]) return interaction.reply({ embeds: [errorEmbed('Configuration introuvable.')], ephemeral: true });
    delete guildConfig.autoReact[id];
    db.save();
    return interaction.reply({ embeds: [successEmbed('Configuration auto-react supprimée.')], ephemeral: true });
  }
  if (sub === 'list') {
    const entries = Object.entries(guildConfig.autoReact);
    if (entries.length === 0) return interaction.reply({ embeds: [errorEmbed('Aucune configuration auto-react.')], ephemeral: true });
    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('🔁 Auto-react')
      .setDescription(entries.map(([id, v]) => `\`${id}\` — type: ${v.type} — salon: <#${v.channelId}> — ${v.emojis.join(' ')}`).join('\n'));
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handlePermissions(interaction, guildConfig, db, sub) {
  if (sub === 'add') {
    const action = interaction.options.getString('action');
    const role = interaction.options.getRole('role');
    if (!guildConfig.permissions[action].includes(role.id)) guildConfig.permissions[action].push(role.id);
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Rôle ${role} autorisé pour cette action.`)], ephemeral: true });
  }
  if (sub === 'remove') {
    const action = interaction.options.getString('action');
    const role = interaction.options.getRole('role');
    guildConfig.permissions[action] = guildConfig.permissions[action].filter((id) => id !== role.id);
    db.save();
    return interaction.reply({ embeds: [successEmbed(`Rôle ${role} retiré de cette action.`)], ephemeral: true });
  }
  if (sub === 'list') {
    const embed = baseEmbed(COLORS.PRIMARY)
      .setTitle('🔐 Permissions')
      .setDescription(
        permissionTargets
          .map((t) => `**${t.name}** — ${(guildConfig.permissions[t.value] || []).map((id) => `<@&${id}>`).join(', ') || '*tout le monde / staff*'}`)
          .join('\n')
      );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
