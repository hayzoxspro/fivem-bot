'use strict';

module.exports = {
  COLORS: {
    PRIMARY: 0x5865f2,
    SUCCESS: 0x2ecc71,
    DANGER: 0xe74c3c,
    WARNING: 0xf1c40f,
    INFO: 0x3498db,
    DARK: 0x2c2f33
  },
  EMOJIS: {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    TICKET: '🎫',
    LOCK: '🔒',
    UNLOCK: '🔓',
    TRASH: '🗑️',
    ARROW: '➜',
    LOADING: '⏳',
    STAFF: '🛡️',
    CLAIM: '🙋'
  },
  LOG_TYPES: {
    member_join: { label: 'Arrivées', emoji: '📥' },
    member_leave: { label: 'Départs', emoji: '📤' },
    ticket: { label: 'Tickets', emoji: '🎫' },
    message_delete: { label: 'Messages supprimés', emoji: '🗑️' },
    message_update: { label: 'Messages modifiés', emoji: '✏️' },
    ban: { label: 'Ban', emoji: '🔨' },
    unban: { label: 'Unban', emoji: '♻️' },
    kick: { label: 'Kick', emoji: '👢' },
    timeout: { label: 'Timeout', emoji: '🔇' },
    channel_create: { label: 'Création de salon', emoji: '📁' },
    channel_delete: { label: 'Suppression de salon', emoji: '🗑️' },
    role_create: { label: 'Création de rôle', emoji: '🎭' },
    role_delete: { label: 'Suppression de rôle', emoji: '🎭' },
    nickname: { label: 'Changement de pseudo', emoji: '📝' },
    member_role_update: { label: 'Changement de rôle', emoji: '🔁' },
    invite: { label: 'Invitations', emoji: '📨' },
    bot_error: { label: 'Erreurs du bot', emoji: '🐛' }
  },
  BRAND: {
    NAME: 'Gang Manager',
    FOOTER: 'Gang Manager • FiveM RP'
  }
};
