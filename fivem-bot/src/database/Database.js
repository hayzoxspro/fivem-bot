'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Base de données "zero-config" basée sur un fichier JSON.
 * Aucune dépendance native (donc aucun risque de build cassé sur Railway).
 * Le fichier + le dossier sont créés automatiquement au premier démarrage.
 *
 * Structure :
 * {
 *   guilds: {
 *     [guildId]: {
 *       welcome: {...},
 *       leave: {...},
 *       logs: {...},
 *       tickets: { panels: {}, categories: {}, settings: {}, counter: 0, open: {}, history: [] },
 *       presences: { [id]: {...} },
 *       autoReact: { [id]: {...} },
 *       permissions: {...},
 *       embedDrafts: { [userId]: {...} }
 *     }
 *   }
 * }
 */
class Database {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, '..', '..', 'data', 'database.json');
    this.dir = path.dirname(this.filePath);
    this.data = null;
    this._saveTimeout = null;
    this._init();
  }

  _init() {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      const initial = { guilds: {} };
      fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), 'utf8');
      this.data = initial;
    } else {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = raw.trim() ? JSON.parse(raw) : { guilds: {} };
        if (!this.data.guilds) this.data.guilds = {};
      } catch (err) {
        // Fichier corrompu -> on repart sur une base saine plutôt que de crasher le bot
        console.error('[Database] Fichier corrompu, réinitialisation :', err.message);
        this.data = { guilds: {} };
        this._writeSync();
      }
    }
  }

  _writeSync() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Database] Erreur d\'écriture :', err.message);
    }
  }

  /** Sauvegarde différée (debounce) pour éviter les écritures disque excessives. */
  save() {
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      this._writeSync();
      this._saveTimeout = null;
    }, 250);
  }

  /** Sauvegarde immédiate, utilisée avant un arrêt propre du process. */
  saveSync() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }
    this._writeSync();
  }

  _defaultGuild() {
    return {
      welcome: {
        enabled: false,
        channelId: null,
        title: '👋 Bienvenue {username} !',
        description: 'Bienvenue sur **{server}**, {user} !\nNous sommes maintenant **{members}** membres.',
        color: '#2ecc71',
        imageUrl: null,
        thumbnail: true,
        footer: 'A bientôt !'
      },
      leave: {
        enabled: false,
        channelId: null,
        title: '📤 Départ',
        description: '**{username}** a quitté **{server}**.\nTemps passé sur le serveur : {duration}',
        color: '#e74c3c',
        thumbnail: true
      },
      logs: {
        // clé: type de log -> channelId
        channels: {
          member_join: null,
          member_leave: null,
          ticket: null,
          message_delete: null,
          message_update: null,
          ban: null,
          unban: null,
          kick: null,
          timeout: null,
          channel_create: null,
          channel_delete: null,
          role_create: null,
          role_delete: null,
          nickname: null,
          member_role_update: null,
          invite: null,
          bot_error: null
        }
      },
      tickets: {
        panels: {},       // panelId -> { title, description, color, categories: [catId,...], channelId, messageId }
        categories: {},   // catId -> { name, emoji, categoryChannelId, staffRoleIds: [], transcriptChannelId, dmTranscript, ticketLimit, welcomeMessage }
        counter: 0,
        open: {},         // channelId -> { catId, panelId, ownerId, claimedBy, createdAt, number }
        history: []       // { number, ownerId, catId, closedBy, closedAt, transcriptUrl }
      },
      presences: {},       // id -> { text, hour, minute, channelId, enabled, reactions: [emoji,...], lastRunDate }
      autoReact: {},        // id -> { type: 'bot'|'message', channelId, messageId, emojis: [], enabled }
      permissions: {
        ticketOpenRoleIds: [],   // vide = tout le monde
        ticketCloseRoleIds: [],
        logsViewRoleIds: [],
        commandsRoleIds: {}      // commandName -> [roleIds] (vide = defaults Discord perms)
      },
      embedDrafts: {}
    };
  }

  getGuild(guildId) {
    if (!this.data.guilds[guildId]) {
      this.data.guilds[guildId] = this._defaultGuild();
      this.save();
    } else {
      // Fusion douce pour ajouter les nouvelles clés si le bot est mis à jour
      this.data.guilds[guildId] = this._deepMerge(this._defaultGuild(), this.data.guilds[guildId]);
    }
    return this.data.guilds[guildId];
  }

  _deepMerge(base, override) {
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const key of Object.keys(override || {})) {
      if (
        override[key] &&
        typeof override[key] === 'object' &&
        !Array.isArray(override[key]) &&
        base[key] &&
        typeof base[key] === 'object' &&
        !Array.isArray(base[key])
      ) {
        out[key] = this._deepMerge(base[key], override[key]);
      } else {
        out[key] = override[key];
      }
    }
    return out;
  }

  updateGuild(guildId, updater) {
    const guild = this.getGuild(guildId);
    updater(guild);
    this.save();
    return guild;
  }
}

module.exports = Database;
