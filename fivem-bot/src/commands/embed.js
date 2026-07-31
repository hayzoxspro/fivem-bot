'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { baseEmbed, successEmbed, errorEmbed, parseColor } = require('../utils/embeds');
const { COLORS } = require('../config/constants');

function getDraft(guildConfig, userId) {
  if (!guildConfig.embedDrafts[userId]) {
    guildConfig.embedDrafts[userId] = { fields: [], buttons: [], timestamp: false };
  }
  return guildConfig.embedDrafts[userId];
}

function buildEmbedFromDraft(draft) {
  const embed = baseEmbed(parseColor(draft.color));
  if (draft.title) embed.setTitle(draft.title);
  if (draft.description) embed.setDescription(draft.description);
  if (draft.footer) embed.setFooter({ text: draft.footer, iconURL: draft.footerIcon || undefined });
  if (draft.author) embed.setAuthor({ name: draft.author, iconURL: draft.authorIcon || undefined });
  if (draft.thumbnail) embed.setThumbnail(draft.thumbnail);
  if (draft.image) embed.setImage(draft.image);
  if (draft.fields && draft.fields.length) embed.addFields(draft.fields);
  if (!draft.timestamp) embed.setTimestamp(null);
  return embed;
}

function buildRowFromDraft(draft) {
  if (!draft.buttons || draft.buttons.length === 0) return [];
  const row = new ActionRowBuilder().addComponents(
    draft.buttons.slice(0, 5).map((b) => new ButtonBuilder().setLabel(b.label).setStyle(ButtonStyle.Link).setURL(b.url).setEmoji(b.emoji || undefined))
  );
  return [row];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Générateur d\'embeds personnalisés.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Démarrer / réinitialiser un brouillon d\'embed')
    )
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Modifier les propriétés du brouillon')
        .addStringOption((o) => o.setName('titre').setDescription('Titre').setRequired(false))
        .addStringOption((o) => o.setName('description').setDescription('Description').setRequired(false))
        .addStringOption((o) => o.setName('couleur').setDescription('Couleur hex, ex: #5865F2').setRequired(false))
        .addStringOption((o) => o.setName('footer').setDescription('Texte du footer').setRequired(false))
        .addStringOption((o) => o.setName('auteur').setDescription('Nom de l\'auteur (en haut de l\'embed)').setRequired(false))
        .addStringOption((o) => o.setName('thumbnail').setDescription('URL de la miniature').setRequired(false))
        .addStringOption((o) => o.setName('image').setDescription('URL de l\'image principale').setRequired(false))
        .addBooleanOption((o) => o.setName('timestamp').setDescription('Afficher la date/heure actuelle').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('addfield')
        .setDescription('Ajouter un champ à l\'embed')
        .addStringOption((o) => o.setName('nom').setDescription('Nom du champ').setRequired(true))
        .addStringOption((o) => o.setName('valeur').setDescription('Valeur du champ').setRequired(true))
        .addBooleanOption((o) => o.setName('inline').setDescription('Afficher en ligne').setRequired(false))
    )
    .addSubcommand((s) => s.setName('clearfields').setDescription('Supprimer tous les champs'))
    .addSubcommand((s) =>
      s
        .setName('addbutton')
        .setDescription('Ajouter un bouton lien')
        .addStringOption((o) => o.setName('label').setDescription('Texte du bouton').setRequired(true))
        .addStringOption((o) => o.setName('url').setDescription('Lien du bouton').setRequired(true))
        .addStringOption((o) => o.setName('emoji').setDescription('Emoji du bouton').setRequired(false))
    )
    .addSubcommand((s) => s.setName('preview').setDescription('Prévisualiser le brouillon d\'embed'))
    .addSubcommand((s) =>
      s
        .setName('send')
        .setDescription('Envoyer l\'embed dans un salon')
        .addChannelOption((o) => o.setName('salon').setDescription('Salon de destination').addChannelTypes(ChannelType.GuildText).setRequired(true))
    ),

  async execute(interaction) {
    const db = interaction.client.db;
    const guildConfig = db.getGuild(interaction.guild.id);
    const draft = getDraft(guildConfig, interaction.user.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      guildConfig.embedDrafts[interaction.user.id] = { fields: [], buttons: [], timestamp: false };
      db.save();
      return interaction.reply({ embeds: [successEmbed('Nouveau brouillon d\'embed créé. Utilise `/embed set`, `/embed addfield`, `/embed addbutton` puis `/embed send`.')], ephemeral: true });
    }

    if (sub === 'set') {
      const map = {
        titre: 'title',
        description: 'description',
        couleur: 'color',
        footer: 'footer',
        auteur: 'author',
        thumbnail: 'thumbnail',
        image: 'image'
      };
      for (const [optName, key] of Object.entries(map)) {
        const value = interaction.options.getString(optName);
        if (value !== null) draft[key] = value;
      }
      const ts = interaction.options.getBoolean('timestamp');
      if (ts !== null) draft.timestamp = ts;
      db.save();
      return interaction.reply({ embeds: [successEmbed('Brouillon mis à jour.'), buildEmbedFromDraft(draft)], ephemeral: true });
    }

    if (sub === 'addfield') {
      draft.fields.push({
        name: interaction.options.getString('nom'),
        value: interaction.options.getString('valeur'),
        inline: interaction.options.getBoolean('inline') ?? false
      });
      db.save();
      return interaction.reply({ embeds: [successEmbed(`Champ ajouté (${draft.fields.length} au total).`)], ephemeral: true });
    }

    if (sub === 'clearfields') {
      draft.fields = [];
      db.save();
      return interaction.reply({ embeds: [successEmbed('Tous les champs ont été supprimés.')], ephemeral: true });
    }

    if (sub === 'addbutton') {
      if (draft.buttons.length >= 5) {
        return interaction.reply({ embeds: [errorEmbed('Maximum 5 boutons par embed.')], ephemeral: true });
      }
      draft.buttons.push({
        label: interaction.options.getString('label'),
        url: interaction.options.getString('url'),
        emoji: interaction.options.getString('emoji') || null
      });
      db.save();
      return interaction.reply({ embeds: [successEmbed(`Bouton ajouté (${draft.buttons.length}/5).`)], ephemeral: true });
    }

    if (sub === 'preview') {
      if (!draft.title && !draft.description && draft.fields.length === 0) {
        return interaction.reply({ embeds: [errorEmbed('Le brouillon est vide. Utilise `/embed set` pour commencer.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [buildEmbedFromDraft(draft)], components: buildRowFromDraft(draft), ephemeral: true });
    }

    if (sub === 'send') {
      if (!draft.title && !draft.description && draft.fields.length === 0) {
        return interaction.reply({ embeds: [errorEmbed('Le brouillon est vide. Utilise `/embed set` pour commencer.')], ephemeral: true });
      }
      const channel = interaction.options.getChannel('salon');
      await channel.send({ embeds: [buildEmbedFromDraft(draft)], components: buildRowFromDraft(draft) });
      return interaction.reply({ embeds: [successEmbed(`Embed envoyé dans ${channel}.`)], ephemeral: true });
    }
  }
};
