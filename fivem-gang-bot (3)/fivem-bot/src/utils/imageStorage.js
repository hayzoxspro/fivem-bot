'use strict';

const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');

const IMAGES_DIR = path.join(__dirname, '..', '..', 'data', 'images');

function ensureDir() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

/**
 * Télécharge une pièce jointe envoyée dans une commande (upload direct depuis l'ordinateur du
 * membre) et l'enregistre comme vrai fichier dans data/images/. Aucun lien externe n'est manipulé
 * par l'utilisateur : il choisit juste un fichier depuis Discord.
 * @param {import('discord.js').Attachment} attachment
 * @param {string} prefix - préfixe du nom de fichier (ex: "welcome", "convocation")
 * @returns {Promise<string>} le nom de fichier stocké (à conserver en config)
 */
async function saveAttachment(attachment, prefix) {
  ensureDir();
  const ext = path.extname(attachment.name || '') || '.png';
  const filename = `${prefix}-${Date.now()}${ext}`.replace(/[^a-zA-Z0-9._-]/g, '');
  const filepath = path.join(IMAGES_DIR, filename);

  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error(`Téléchargement du fichier échoué (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  return filename;
}

/** Supprime un fichier image stocké (utilisé quand on remplace/efface une image). */
function deleteImage(filename) {
  if (!filename) return;
  const filepath = path.join(IMAGES_DIR, filename);
  fs.existsSync(filepath) && fs.rmSync(filepath, { force: true });
}

/**
 * Construit un AttachmentBuilder prêt à être envoyé, à partir d'un nom de fichier stocké.
 * Renvoie null si le fichier n'existe plus (ex: après un redéploiement sans volume persistant).
 */
function buildAttachment(filename) {
  if (!filename) return null;
  const filepath = path.join(IMAGES_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return new AttachmentBuilder(filepath, { name: filename });
}

/** URI à utiliser dans embed.setImage()/setThumbnail() pour référencer le fichier joint. */
function attachmentUri(filename) {
  return `attachment://${filename}`;
}

module.exports = { saveAttachment, deleteImage, buildAttachment, attachmentUri, IMAGES_DIR };
