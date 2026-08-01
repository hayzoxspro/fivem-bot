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
 *       tickets: { panels: {}, categories: {}, counter: 0, open: {}, history: [] },
 *       convocation: {...},   // présence quotidienne automatique (une seule par serveur)
 *       autoReact: {...},
 *       permissions: {...},
 *       embedDrafts: {...}
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

  save() {
    if (this._saveTimeout) clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      this._writeSync();
      this._saveTimeout = null;
    }, 250);
  }

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
        imageFile: null,
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
        panels: {},
        categories: {},
        counter: 0,
        open: {},
        history: []
      },
      convocation: {
        enabled: false,
        channelId: null,
        hour: 21,
        minute: 0,
        roleId: null,
        title: null,
        imageFile: null,
        lastRunDate: null
      },
      autoReact: {},
      permissions: {
        ticketOpenRoleIds: [],
        ticketCloseRoleIds: [],
        logsViewRoleIds: [],
        commandsRoleIds: {}
      },
      embedDrafts: {}
    };
  }

  getGuild(guildId) {
    if (!this.data.guilds[guildId]) {
      this.data.guilds[guildId] = this._defaultGuild();
      this.save();
    } else {
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
