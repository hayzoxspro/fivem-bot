'use strict';

const { AttachmentBuilder } = require('discord.js');

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatContent(content) {
  let text = escapeHtml(content || '');
  // liens cliquables simples
  text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

function isImage(url) {
  return /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url);
}
function isVideo(url) {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
}

/**
 * Génère un transcript HTML propre pour un salon (ticket).
 * @returns {Promise<AttachmentBuilder>} fichier .html prêt à être envoyé
 */
async function generateTranscript(channel, meta = {}) {
  let messages = [];
  let lastId;

  // On récupère tout l'historique du salon (par lots de 100)
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;
    messages.push(...batch.values());
    lastId = batch.last().id;
    if (batch.size < 100) break;
  }
  messages.reverse();

  const rows = messages
    .map((msg) => {
      const author = msg.author;
      const avatar = author ? author.displayAvatarURL({ size: 64, extension: 'png' }) : '';
      const name = author ? escapeHtml(author.tag) : 'Inconnu';
      const time = msg.createdAt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });

      let body = formatContent(msg.content);

      // Pièces jointes (images / vidéos / fichiers)
      if (msg.attachments && msg.attachments.size > 0) {
        for (const att of msg.attachments.values()) {
          if (isImage(att.url)) {
            body += `<div class="attachment"><img src="${att.url}" alt="image" loading="lazy"></div>`;
          } else if (isVideo(att.url)) {
            body += `<div class="attachment"><video controls src="${att.url}"></video></div>`;
          } else {
            body += `<div class="attachment file"><a href="${att.url}" target="_blank">📎 ${escapeHtml(att.name || 'fichier')}</a></div>`;
          }
        }
      }

      // Embeds simplifiés
      if (msg.embeds && msg.embeds.length > 0) {
        for (const e of msg.embeds) {
          const title = e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : '';
          const desc = e.description ? `<div class="embed-desc">${formatContent(e.description)}</div>` : '';
          if (title || desc) {
            body += `<div class="embed-box" style="border-color:${e.hexColor || '#5865f2'}">${title}${desc}</div>`;
          }
        }
      }

      // Réactions
      let reactions = '';
      if (msg.reactions && msg.reactions.cache.size > 0) {
        reactions = `<div class="reactions">${[...msg.reactions.cache.values()]
          .map((r) => `<span class="reaction">${r.emoji.toString ? (r.emoji.id ? '🔸' : r.emoji.name) : r.emoji.name} ${r.count}</span>`)
          .join(' ')}</div>`;
      }

      return `<div class="message">
        <img class="avatar" src="${avatar}" alt="avatar">
        <div class="content">
          <div class="meta"><span class="author">${name}</span><span class="time">${time}</span></div>
          <div class="text">${body || '<i class="empty">[message vide]</i>'}</div>
          ${reactions}
        </div>
      </div>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Transcript - ${escapeHtml(channel.name)}</title>
<style>
  body { background:#313338; color:#dbdee1; font-family: 'gg sans', 'Helvetica Neue', Arial, sans-serif; margin:0; padding:0; }
  .header { background:#2b2d31; padding:20px 30px; border-bottom:1px solid #1e1f22; }
  .header h1 { margin:0; font-size:20px; color:#fff; }
  .header p { margin:4px 0 0; color:#949ba4; font-size:13px; }
  .container { max-width:900px; margin:0 auto; padding:20px; }
  .message { display:flex; gap:14px; padding:10px 8px; border-radius:6px; }
  .message:hover { background:#2e3035; }
  .avatar { width:40px; height:40px; border-radius:50%; flex-shrink:0; }
  .content { flex:1; min-width:0; }
  .meta { display:flex; align-items:baseline; gap:8px; }
  .author { font-weight:600; color:#f2f3f5; }
  .time { font-size:11px; color:#949ba4; }
  .text { white-space:pre-wrap; word-wrap:break-word; line-height:1.4; margin-top:2px; }
  .empty { color:#6d6f78; }
  .attachment img { max-width:380px; max-height:300px; border-radius:8px; margin-top:6px; display:block; }
  .attachment video { max-width:380px; border-radius:8px; margin-top:6px; }
  .attachment.file a { color:#00a8fc; text-decoration:none; }
  .embed-box { border-left:4px solid #5865f2; background:#2b2d31; padding:10px 12px; border-radius:4px; margin-top:6px; max-width:520px; }
  .embed-title { font-weight:600; color:#fff; margin-bottom:4px; }
  .reactions { margin-top:6px; }
  .reaction { background:#2b2d31; border:1px solid #3f4147; border-radius:10px; padding:2px 8px; font-size:12px; margin-right:4px; }
  a { color:#00a8fc; }
</style>
</head>
<body>
  <div class="header">
    <h1>🎫 Transcript — #${escapeHtml(channel.name)}</h1>
    <p>Ticket n°${meta.number ?? '?'} • Ouvert par ${escapeHtml(meta.ownerTag || 'inconnu')} • Généré le ${new Date().toLocaleString('fr-FR')}</p>
    <p>${messages.length} message(s)</p>
  </div>
  <div class="container">
    ${rows || '<p style="color:#949ba4">Aucun message.</p>'}
  </div>
</body>
</html>`;

  const buffer = Buffer.from(html, 'utf8');
  return new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.html` });
}

module.exports = { generateTranscript };
