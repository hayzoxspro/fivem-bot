'use strict';

const { EmbedBuilder } = require('discord.js');
const { COLORS, BRAND } = require('../config/constants');

function baseEmbed(color = COLORS.PRIMARY) {
  return new EmbedBuilder().setColor(color).setFooter({ text: BRAND.FOOTER }).setTimestamp();
}

function successEmbed(description, title = 'Succès') {
  return baseEmbed(COLORS.SUCCESS).setTitle(`✅ ${title}`).setDescription(description);
}

function errorEmbed(description, title = 'Erreur') {
  return baseEmbed(COLORS.DANGER).setTitle(`❌ ${title}`).setDescription(description);
}

function warningEmbed(description, title = 'Attention') {
  return baseEmbed(COLORS.WARNING).setTitle(`⚠️ ${title}`).setDescription(description);
}

function infoEmbed(description, title = 'Information') {
  return baseEmbed(COLORS.INFO).setTitle(`ℹ️ ${title}`).setDescription(description);
}

/** Remplace les variables {user}, {username}, {server}, {members}, {duration} dans un texte. */
function applyPlaceholders(text, member, extra = {}) {
  if (!text) return text;
  const guild = member.guild;
  return text
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{username}/g, member.user ? member.user.username : member.username)
    .replace(/{server}/g, guild.name)
    .replace(/{members}/g, `${guild.memberCount}`)
    .replace(/{duration}/g, extra.duration || 'inconnu');
}

function parseColor(hex, fallback = COLORS.PRIMARY) {
  if (!hex) return fallback;
  try {
    const clean = hex.toString().replace('#', '');
    const value = parseInt(clean, 16);
    return Number.isNaN(value) ? fallback : value;
  } catch {
    return fallback;
  }
}

module.exports = { baseEmbed, successEmbed, errorEmbed, warningEmbed, infoEmbed, applyPlaceholders, parseColor };
