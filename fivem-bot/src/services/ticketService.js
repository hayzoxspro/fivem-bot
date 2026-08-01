'use strict';

const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { baseEmbed, successEmbed, errorEmbed } = require('../utils/embeds');
const { COLORS, EMOJIS } = require('../config/constants');
const { generateTranscript } = require('./transcriptService');
const logger = require('../utils/logger');

class TicketService {
  constructor(client, db, logService) {
    this.client = client;
    this.db = db;
    this.logService = logService;
  }

  ticketControlRow(state = {}) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel('Prendre en charge')
        .setEmoji(EMOJIS.CLAIM)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!!state.claimed),
      new ButtonBuilder()
        .setCustomId('ticket_add_member')
        .setLabel('Ajouter')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ticket_remove_member')
        .setLabel('Retirer')
        .setEmoji('➖')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ticket_rename')
        .setLabel('Renommer')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Fermer')
        .setEmoji(EMOJIS.LOCK)
        .setStyle(ButtonStyle.Danger)
    );
    return row;
  }

  closedControlRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_reopen').setLabel('Réouvrir').setEmoji(EMOJIS.UNLOCK).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('ticket_delete').setLabel('Supprimer').setEmoji(EMOJIS.TRASH).setStyle(ButtonStyle.Danger)
    );
  }

  /** Compte le nombre de tickets ouverts par un utilisateur dans une catégorie donnée. */
  countOpenTicketsFor(guildConfig, userId, categoryId) {
    return Object.values(guildConfig.tickets.open).filter(
      (t) => t.ownerId === userId && (!categoryId || t.catId === categoryId)
    ).length;
  }

  async openTicket(interaction, categoryId) {
    const guild = interaction.guild;
    const member = interaction.member;
    const guildConfig = this.db.getGuild(guild.id);
    const category = guildConfig.tickets.categories[categoryId];

    if (!category) {
      return interaction.reply({ embeds: [errorEmbed('Cette catégorie de ticket est introuvable ou a été supprimée.')], ephemeral: true });
    }

    const limit = category.ticketLimit || 1;
    const openCount = this.countOpenTicketsFor(guildConfig, member.id, categoryId);
    if (openCount >= limit) {
      return interaction.reply({
        embeds: [errorEmbed(`Tu as déjà atteint la limite de **${limit}** ticket(s) ouvert(s) pour cette catégorie.`)],
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    guildConfig.tickets.counter += 1;
    const number = guildConfig.tickets.counter;
    const channelName = `${category.emoji ? '' : ''}ticket-${number}`.toLowerCase();

    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: member.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles
        ]
      },
      {
        id: this.client.user.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels]
      }
    ];
    for (const roleId of category.staffRoleIds || []) {
      overwrites.push({
        id: roleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
      });
    }

    let channel;
    try {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.categoryChannelId || undefined,
        permissionOverwrites: overwrites,
        topic: `Ticket #${number} • Ouvert par ${member.user.tag} (${member.id}) • Catégorie: ${category.name}`
      });
    } catch (err) {
      await this.logService.botError(guild.id, err, 'openTicket - création du salon');
      return interaction.editReply({ embeds: [errorEmbed("Impossible de créer le salon du ticket. Vérifie mes permissions.")] });
    }

    guildConfig.tickets.open[channel.id] = {
      catId: categoryId,
      ownerId: member.id,
      claimedBy: null,
      createdAt: Date.now(),
      number
    };
    this.db.save();

    const staffMentions = (category.staffRoleIds || []).map((id) => `<@&${id}>`).join(' ');
    const welcomeEmbed = baseEmbed(COLORS.PRIMARY)
      .setTitle(`${EMOJIS.TICKET} Ticket #${number} — ${category.name}`)
      .setDescription(
        category.welcomeMessage ||
          `Bienvenue ${member} !\nUn membre du staff va s'occuper de toi rapidement.\nDécris ta demande avec un maximum de détails.`
      );

    await channel.send({ content: `${member} ${staffMentions}`.trim(), embeds: [welcomeEmbed], components: [this.ticketControlRow()] });

    await interaction.editReply({ embeds: [successEmbed(`Ton ticket a été créé : ${channel}`)] });

    await this.logService.send(guild.id, 'ticket', {
      title: 'Ticket ouvert',
      description: `**Ticket** : #${number} (${channel})\n**Ouvert par** : ${member} (${member.id})\n**Catégorie** : ${category.name}`,
      color: COLORS.SUCCESS
    });
  }

  async closeTicket(interaction) {
    const guild = interaction.guild;
    const guildConfig = this.db.getGuild(guild.id);
    const ticket = guildConfig.tickets.open[interaction.channel.id];
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Ce salon n\'est pas un ticket actif.')], ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => null);

    ticket.closed = true;
    ticket.closedBy = interaction.user.id;
    ticket.closedAt = Date.now();
    this.db.save();

    try {
      await interaction.channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: false });
    } catch {
      /* ignore */
    }

    const embed = baseEmbed(COLORS.WARNING)
      .setTitle(`${EMOJIS.LOCK} Ticket fermé`)
      .setDescription(`Fermé par ${interaction.user}.\nUn membre du staff peut le réouvrir ou le supprimer définitivement.`);

    await interaction.channel.send({ embeds: [embed], components: [this.closedControlRow()] });

    await this.logService.send(guild.id, 'ticket', {
      title: 'Ticket fermé',
      description: `**Ticket** : #${ticket.number} (${interaction.channel})\n**Fermé par** : ${interaction.user}`,
      color: COLORS.WARNING
    });
  }

  async reopenTicket(interaction) {
    const guild = interaction.guild;
    const guildConfig = this.db.getGuild(guild.id);
    const ticket = guildConfig.tickets.open[interaction.channel.id];
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Ce salon n\'est pas un ticket connu.')], ephemeral: true });
    }
    ticket.closed = false;
    this.db.save();

    try {
      await interaction.channel.permissionOverwrites.edit(ticket.ownerId, { SendMessages: true });
    } catch {
      /* ignore */
    }

    await interaction.update({
      embeds: [successEmbed(`Ticket réouvert par ${interaction.user}.`)],
      components: [this.ticketControlRow({ claimed: !!ticket.claimedBy })]
    });

    await this.logService.send(guild.id, 'ticket', {
      title: 'Ticket réouvert',
      description: `**Ticket** : #${ticket.number} (${interaction.channel})\n**Réouvert par** : ${interaction.user}`,
      color: COLORS.INFO
    });
  }

  async deleteTicket(interaction) {
    const guild = interaction.guild;
    const guildConfig = this.db.getGuild(guild.id);
    const channel = interaction.channel;
    const ticket = guildConfig.tickets.open[channel.id];
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Ce salon n\'est pas un ticket connu.')], ephemeral: true });
    }

    await interaction.reply({ embeds: [infoEmbedSafe('Suppression du ticket en cours, génération du transcript...')] });

    const category = guildConfig.tickets.categories[ticket.catId] || {};
    let owner = null;
    try {
      owner = await guild.members.fetch(ticket.ownerId);
    } catch {
      /* membre parti */
    }

    let transcriptFile;
    try {
      transcriptFile = await generateTranscript(channel, { number: ticket.number, ownerTag: owner ? owner.user.tag : ticket.ownerId });
    } catch (err) {
      await this.logService.botError(guild.id, err, 'deleteTicket - génération transcript');
    }

    // Envoi du transcript dans le salon configuré
    if (transcriptFile && category.transcriptChannelId) {
      const transcriptChannel = guild.channels.cache.get(category.transcriptChannelId);
      if (transcriptChannel && transcriptChannel.isTextBased()) {
        const embed = baseEmbed(COLORS.DARK)
          .setTitle(`📄 Transcript — Ticket #${ticket.number}`)
          .setDescription(`**Catégorie** : ${category.name || 'Inconnue'}\n**Ouvert par** : <@${ticket.ownerId}>\n**Fermé/Supprimé par** : ${interaction.user}`);
        await transcriptChannel.send({ embeds: [embed], files: [transcriptFile] }).catch(() => null);
      }
    }

    // Copie en DM au créateur si activé
    if (transcriptFile && category.dmTranscript && owner) {
      const dmEmbed = baseEmbed(COLORS.DARK)
        .setTitle(`📄 Transcript de ton ticket #${ticket.number}`)
        .setDescription(`Serveur : **${guild.name}**`);
      await owner.send({ embeds: [dmEmbed], files: [transcriptFile] }).catch(() => null);
    }

    guildConfig.tickets.history.push({
      number: ticket.number,
      ownerId: ticket.ownerId,
      catId: ticket.catId,
      closedBy: interaction.user.id,
      closedAt: Date.now()
    });
    delete guildConfig.tickets.open[channel.id];
    this.db.save();

    await this.logService.send(guild.id, 'ticket', {
      title: 'Ticket supprimé',
      description: `**Ticket** : #${ticket.number}\n**Supprimé par** : ${interaction.user}\n**Salon** : #${channel.name}`,
      color: COLORS.DANGER
    });

    setTimeout(() => {
      channel.delete().catch(() => null);
    }, 3000);
  }

  async claimTicket(interaction) {
    const guildConfig = this.db.getGuild(interaction.guild.id);
    const ticket = guildConfig.tickets.open[interaction.channel.id];
    if (!ticket) {
      return interaction.reply({ embeds: [errorEmbed('Ce salon n\'est pas un ticket actif.')], ephemeral: true });
    }
    ticket.claimedBy = interaction.user.id;
    this.db.save();

    await interaction.update({ components: [this.ticketControlRow({ claimed: true })] });
    await interaction.followUp({ embeds: [successEmbed(`${interaction.user} a pris en charge ce ticket.`)] });
  }
}

// petit helper local pour éviter un import circulaire inutile
function infoEmbedSafe(desc) {
  const { infoEmbed } = require('../utils/embeds');
  return infoEmbed(desc);
}

module.exports = TicketService;
