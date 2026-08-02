'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { baseEmbed } = require('../utils/embeds');
const { parseColor } = require('../utils/embeds');
const { buildAttachment, attachmentUri } = require('../utils/imageStorage');

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);
}

/**
 * Construit les composants permettant d'ouvrir un ticket : un simple bouton s'il n'y a qu'un seul
 * type de ticket (cas le plus courant et le plus simple), sinon un menu déroulant.
 */
function buildOpenComponents(panelId, panel, categories) {
  if (panel.categories.length === 1) {
    const catId = panel.categories[0];
    const cat = categories[catId];
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_open_btn::${panelId}::${catId}`)
          .setLabel('Ouvrir un ticket')
          .setEmoji(cat?.emoji || '🎫')
          .setStyle(ButtonStyle.Primary)
      )
    ];
  }

  const options = panel.categories
    .map((catId) => {
      const cat = categories[catId];
      if (!cat) return null;
      return { label: cat.name, value: `${panelId}::${catId}`, emoji: cat.emoji || undefined };
    })
    .filter(Boolean);

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('ticket_open_select').setPlaceholder('📩 Choisis une catégorie pour ouvrir un ticket').addOptions(options)
    )
  ];
}

/** Crée un panel (+ son unique type de ticket) avec des réglages simples et des valeurs par défaut. */
function createSimplePanel(guildConfig, { name, roleId, transcriptChannelId = null, dmTranscript = false, limit = 1, title = null, description = null, color = '#5865F2', imageFile = null }) {
  const panelId = slugify(name) || `panel-${Date.now()}`;
  const catId = panelId;

  guildConfig.tickets.categories[catId] = {
    name,
    emoji: '🎫',
    categoryChannelId: null,
    staffRoleIds: [roleId],
    transcriptChannelId,
    dmTranscript,
    ticketLimit: limit,
    welcomeMessage: null
  };

  guildConfig.tickets.panels[panelId] = {
    name,
    title: title || `🎫 ${name}`,
    description: description || 'Clique sur le bouton ci-dessous pour ouvrir un ticket.\nUn membre du staff te répondra rapidement.',
    color,
    categories: [catId],
    channelId: null,
    messageId: null,
    imageFile
  };

  return panelId;
}

/** Publie (ou republie) le panel dans un salon. */
async function postPanelMessage(guild, guildConfig, panelId, channel) {
  const panel = guildConfig.tickets.panels[panelId];
  if (!panel || !panel.categories || panel.categories.length === 0) {
    return { ok: false, error: "Ce panel n'a aucun type de ticket." };
  }

  const embed = baseEmbed(parseColor(panel.color)).setTitle(panel.title).setDescription(panel.description);
  const files = [];
  const attachment = buildAttachment(panel.imageFile);
  if (attachment) {
    embed.setImage(attachmentUri(panel.imageFile));
    files.push(attachment);
  }

  const components = buildOpenComponents(panelId, panel, guildConfig.tickets.categories);

  try {
    const message = await channel.send({ embeds: [embed], components, files });
    panel.channelId = channel.id;
    panel.messageId = message.id;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Impossible de publier le panel (vérifie mes permissions dans ce salon).' };
  }
}

module.exports = { slugify, buildOpenComponents, createSimplePanel, postPanelMessage };
