# 🎮 Gang Manager — Bot Discord pour serveur FiveM RP

Bot Discord professionnel (Node.js + discord.js v14) pour serveur FiveM RP : tickets complets avec transcripts HTML,
logs configurables, bienvenue/départ, présences automatiques, auto-react, générateur d'embeds, dashboard, et plus —
**tout configurable depuis Discord**, sans jamais toucher au code.

---

## 🚀 Déploiement sur Railway (3 étapes)

1. Importer ce projet sur Railway (New Project → Deploy from GitHub repo / ou upload direct).
2. Dans l'onglet **Variables**, ajouter uniquement :
   ```
   DISCORD_TOKEN=le_token_de_ton_bot
   ```
3. Cliquer sur **Deploy**. C'est tout — la base de données, les dossiers et la configuration se créent
   automatiquement au premier démarrage.

Le bot déploie lui-même ses commandes slash au démarrage (aucune commande `npm run deploy` à lancer).

---

## ⚠️ Étape obligatoire côté Discord Developer Portal (une seule fois)

Ce n'est pas une variable Railway, mais un réglage propre à **tout** bot Discord qui lit les membres/messages —
il ne peut pas être contourné par du code :

1. Va sur https://discord.com/developers/applications → ton application → onglet **Bot**.
2. Active les 3 intents privilégiés :
   - **Server Members Intent**
   - **Message Content Intent**
   - (Presence Intent — optionnel, non requis ici)
3. Invite le bot avec les permissions **Administrator** (le plus simple pour un bot de gestion complet), ou au
   minimum : Gérer les salons, Gérer les rôles, Gérer les messages, Bannir/Expulser, Voir les logs d'audit, Envoyer
   des messages, Intégrer des liens, Joindre des fichiers, Ajouter des réactions.

Sans ces intents activés, Discord refusera la connexion du bot (erreur "Disallowed intents").

---

## ✨ Fonctionnalités

- **Tickets ultra simples** : `/ticket create` crée ET publie le panel en une seule commande (plus besoin de
  jongler entre catégories et panels séparés). Claim, ajout/retrait de membre, renommage, fermeture/réouverture,
  suppression avec confirmation, **transcript HTML** (messages, images, vidéos, fichiers, réactions) envoyé dans
  un salon configurable + copie DM optionnelle. `/ticket addtype` seulement si tu veux plusieurs catégories.
- **Bienvenue / Départ** : embeds personnalisables avec variables `{user}` `{username}` `{server}` `{members}`
  `{duration}`, avatar, footer, et une **image envoyée directement en pièce jointe** (upload du fichier depuis
  ton ordinateur dans la commande — aucun lien à copier/coller).
- **Logs** : 17 types (arrivées, départs, tickets, messages supprimés/modifiés, ban, unban, kick, timeout, salons,
  rôles, pseudo, rôles de membre, invitations, erreurs bot), chacun avec son propre salon.
- **Convocation quotidienne** (`/config convocation`) : un seul message automatique par serveur, envoyé chaque
  jour à l'heure choisie ("réinitialisé" naturellement à minuit puisqu'un nouveau message est posté chaque jour),
  avec la date du jour, un rôle à convoquer/mentionner (optionnel), une image en pièce jointe (optionnel), et les
  réactions ✅ (Présent) / ❌ (Absent) / ⏳ (Retard) automatiquement ajoutées.
- **Auto-react** : réactions automatiques sur les messages du bot ou sur un message précis.
- **Générateur d'embeds** : titre, description, couleur, footer, auteur, thumbnail et image **en upload direct**,
  champs, boutons liens, timestamp — brouillon par utilisateur, prévisualisation, envoi.
- **Permissions** : qui peut ouvrir/gérer un ticket, qui peut voir les logs.
- **Dashboard** (`/dashboard`) : statut, uptime, ping, nombre de tickets, membres, mémoire.
- **Commandes utiles** : `/ping` `/help` `/userinfo` `/serverinfo` `/avatar`.
- **Sécurité** : anti-spam de tickets (limite configurable), vérification des permissions partout, gestion complète
  des erreurs, anti-crash (process ne s'arrête jamais sur une erreur), reconnexion automatique, protection contre
  les doubles interactions (boutons désactivés après action).

### 🖼️ Images sans lien

Partout où une image est demandée (bienvenue, convocation, panel de ticket, embed builder), le champ est un
**upload de fichier direct dans la commande Discord** (`image:` avec un trombone 📎) — jamais un champ où coller
une URL. Le bot télécharge le fichier une fois et le stocke dans `data/images/` sur le serveur, puis le renvoie
à chaque fois comme une vraie pièce jointe.

---

## 🗂️ Architecture

```
index.js                     Point d'entrée (anti-crash, reconnexion, arrêt propre)
src/
  client.js                  Construction du client Discord + injection des services
  database/Database.js       Base de données JSON zero-config (auto-créée)
  config/constants.js        Couleurs, emojis, types de logs
  handlers/                  Chargement dynamique des commandes et events
  events/                    Tous les listeners Discord (arrivée, départ, logs, interactions...)
  commands/                  Toutes les slash commands (/ticket, /config, /embed, /dashboard, ...)
  services/                  Logique métier (tickets, transcripts, logs, scheduler de présences)
  utils/                     Embeds, permissions, logger
```

---

## 💾 Base de données

Fichier JSON auto-créé (`data/database.json`) au premier démarrage — aucune configuration nécessaire. Toutes les
configs (welcome, leave, logs, tickets, présences, auto-react, permissions) y sont sauvegardées automatiquement à
chaque modification.

> Note Railway : le système de fichiers d'un service Railway sans volume persistant est réinitialisé à chaque
> redéploiement — **y compris les images uploadées** dans `data/images/` (bienvenue, convocation, panels de
> tickets). Pour tout conserver entre deux déploiements, ajoute un **Volume** Railway monté sur `/app/data`
> (Settings → Volumes). C'est optionnel mais fortement recommandé si tu utilises les images. Sans volume, le bot
> ne plantera jamais : il recrée juste une base vierge et il suffit de reconfigurer les images une fois après un
> redéploiement.

---

## 🧭 Commandes principales

| Commande | Description |
|---|---|
| `/ticket create` | Crée **et publie** un panel de tickets en une seule commande |
| `/ticket addtype` / `post` / `delete` / `list` | Gestion avancée (optionnelle) des panels |
| `/config welcome set` / `preview` | Configurer le message d'arrivée (image en upload direct) |
| `/config leave set` | Configurer le message de départ |
| `/config logs set` / `remove` / `list` | Configurer les salons de logs |
| `/config convocation set` / `off` / `preview` / `status` | Présence quotidienne automatique |
| `/config autoreact bot` / `message` | Réactions automatiques |
| `/config permissions add` / `remove` / `list` | Gérer les permissions |
| `/embed create` / `set` / `addfield` / `addbutton` / `send` | Générateur d'embeds (images en upload direct) |
| `/dashboard` | Tableau de bord du bot |

### 📝 Exemple concret : mettre en place la convocation de ton screenshot

```
/config convocation set salon:#présence heure:21 minute:0 role_a_convoquer:@Membre image:[upload ton logo] titre:
```
Laisse `titre` vide pour que le bot génère automatiquement "📢 Présence demandée le 31/07/26 à 21h" avec la date
du jour. Le message se renvoie tout seul chaque jour à 21h ; comme c'est un nouveau message à chaque fois, les
réactions ✅ ❌ ⏳ repartent forcément de zéro (le "reset à minuit" est donc automatique, rien à faire).

---

## 🛠️ Développement local

```bash
npm install
cp .env.example .env   # puis renseigner DISCORD_TOKEN
npm start
```
