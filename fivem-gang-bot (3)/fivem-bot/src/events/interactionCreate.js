'use strict';

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionsBitField } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { canOpenTicket, canManageTicket } = require('../utils/permissions');
const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    try {
      if (interaction.isChatInputCommand()) return handleCommand(client, interaction);
      if (interaction.isAutocomplete()) return handleAutocomplete(client, interaction);
      if (interaction.isStringSelectMenu()) return handleSelectMenu(client, interaction);
      if (interaction.isChannelSelectMenu()) return handleChannelSelectMenu(client, interaction);
      if (interaction.isRoleSelectMenu()) return handleRoleSelectMenu(client, interaction);
      if (interaction.isButton()) return handleButton(client, interaction);
      if (interaction.isModalSubmit()) return handleModal(client, interaction);
    } catch (err) {
      await client.logService.botError(interaction.guild?.id, err, `interactionCreate (${interaction.type})`);
      const payload = { embeds: [errorEmbed('Une erreur inattendue est survenue. Le staff a été notifié.')], ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
  }
};

async function handleCommand(client, interaction) {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  await command.execute(interaction);
}

async function handleAutocomplete(client, interaction) {
  const command = client.commands.get(interaction.commandName);
  if (!command || !command.autocomplete) return;
  await command.autocomplete(interaction).catch(() => null);
}

async function handleSelectMenu(client, interaction) {
  const id = interaction.customId;

  if (id === 'ticket_open_select') {
    const [panelId, catId] = interaction.values[0].split('::');
    const guildConfig = client.db.getGuild(interaction.guild.id);
    if (!canOpenTicket(interaction.member, guildConfig)) {
      return interaction.reply({ embeds: [errorEmbed('Tu n\'as pas la permission d\'ouvrir un ticket.')], ephemeral: true });
    }
    return client.ticketService.openTicket(interaction, catId);
  }

  if (id === 'setup_convocation_time') {
    return require('../commands/setup').convocationTimeChosen(interaction);
  }
}

async function handleChannelSelectMenu(client, interaction) {
  const id = interaction.customId;
  const setupCmd = require('../commands/setup');
  if (id === 'setup_ticket_channel') return setupCmd.ticketChannelChosen(interaction);
  if (id === 'setup_welcome_channel') return setupCmd.welcomeChannelChosen(interaction);
  if (id === 'setup_convocation_channel') return setupCmd.convocationChannelChosen(interaction);
}

async function handleRoleSelectMenu(client, interaction) {
  const id = interaction.customId;
  const setupCmd = require('../commands/setup');
  if (id === 'setup_ticket_role') return setupCmd.ticketRoleChosen(interaction);
  if (id === 'setup_convocation_role') return setupCmd.convocationFinish(interaction, interaction.values[0]);
}

async function handleButton(client, interaction) {
  const id = interaction.customId;
  const db = client.db;

  if (id.startsWith('setup_')) {
    const setupCmd = require('../commands/setup');
    if (id === 'setup_ticket') return setupCmd.ticketStart(interaction);
    if (id === 'setup_welcome') return setupCmd.welcomeStart(interaction);
    if (id === 'setup_convocation') return setupCmd.convocationStart(interaction);
    if (id === 'setup_convocation_skip') return setupCmd.convocationFinish(interaction, null);
    if (id === 'setup_status') return setupCmd.status(interaction);
    if (id === 'setup_back') return interaction.update(setupCmd.mainMenuPayload());
    return;
  }

  if (id === 'dashboard_refresh') {
    const command = client.commands.get('dashboard');
    return command.execute(interaction);
  }

  if (id.startsWith('ticket_open_btn::')) {
    const [, panelId, catId] = id.split('::');
    const guildConfig = db.getGuild(interaction.guild.id);
    if (!canOpenTicket(interaction.member, guildConfig)) {
      return interaction.reply({ embeds: [errorEmbed('Tu n\'as pas la permission d\'ouvrir un ticket.')], ephemeral: true });
    }
    return client.ticketService.openTicket(interaction, catId);
  }

  if (id.startsWith('ticket_') && !id.startsWith('ticket_open_btn')) {
    const guildConfig = db.getGuild(interaction.guild.id);
    const ticket = guildConfig.tickets.open[interaction.channel.id];

    if (id === 'ticket_claim') {
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('Ticket introuvable.')], ephemeral: true });
      const category = guildConfig.tickets.categories[ticket.catId];
      if (!canManageTicket(interaction.member, category)) {
        return interaction.reply({ embeds: [errorEmbed('Tu n\'as pas la permission de gérer ce ticket.')], ephemeral: true });
      }
      return client.ticketService.claimTicket(interaction);
    }

    if (id === 'ticket_close') {
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('Ticket introuvable.')], ephemeral: true });
      const category = guildConfig.tickets.categories[ticket.catId];
      const isOwner = interaction.user.id === ticket.ownerId;
      if (!isOwner && !canManageTicket(interaction.member, category)) {
        return interaction.reply({ embeds: [errorEmbed('Tu n\'as pas la permission de fermer ce ticket.')], ephemeral: true });
      }
      return client.ticketService.closeTicket(interaction);
    }

    if (id === 'ticket_reopen') {
      const category = guildConfig.tickets.categories[ticket?.catId];
      if (!canManageTicket(interaction.member, category)) {
        return interaction.reply({ embeds: [errorEmbed('Tu n\'as pas la permission de réouvrir ce ticket.')], ephemeral: true });
      }
      return client.ticketService.reopenTicket(interaction);
    }

    if (id === 'ticket_delete') {
      const category = guildConfig.tickets.categories[ticket?.catId];
      if (!canManageTicket(interaction.member, category)) {
        return interaction.reply({ embeds: [errorEmbed('Tu n\'as pas la permission de supprimer ce ticket.')], ephemeral: true });
      }
      // Confirmation avant suppression définitive
      const { ActionRowBuilder: Row, ButtonBuilder: Btn, ButtonStyle } = require('discord.js');
      const row = new Row().addComponents(
        new Btn().setCustomId('ticket_delete_confirm').setLabel('Confirmer la suppression').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
        new Btn().setCustomId('ticket_delete_cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({ embeds: [errorEmbed('Cette action est irréversible. Confirme la suppression du ticket.', 'Confirmation requise')], components: [row] });
    }

    if (id === 'ticket_delete_confirm') {
      await interaction.message.delete().catch(() => null);
      return client.ticketService.deleteTicket(interaction);
    }

    if (id === 'ticket_delete_cancel') {
      return interaction.update({ embeds: [successEmbed('Suppression annulée.')], components: [] });
    }

    if (id === 'ticket_rename') {
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('Ticket introuvable.')], ephemeral: true });
      const category = guildConfig.tickets.categories[ticket.catId];
      if (!canManageTicket(interaction.member, category)) {
        return interaction.reply({ embeds: [errorEmbed('Tu n\'as pas la permission de renommer ce ticket.')], ephemeral: true });
      }
      const modal = new ModalBuilder()
        .setCustomId('ticket_rename_modal')
        .setTitle('Renommer le ticket')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('new_name').setLabel('Nouveau nom du salon').setStyle(TextInputStyle.Short).setMaxLength(90).setRequired(true)
          )
        );
      return interaction.showModal(modal);
    }

    if (id === 'ticket_add_member') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_add_member_modal')
        .setTitle('Ajouter un membre au ticket')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('user_id').setLabel('ID ou mention du membre').setStyle(TextInputStyle.Short).setRequired(true)
          )
        );
      return interaction.showModal(modal);
    }

    if (id === 'ticket_remove_member') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_remove_member_modal')
        .setTitle('Retirer un membre du ticket')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('user_id').setLabel('ID ou mention du membre').setStyle(TextInputStyle.Short).setRequired(true)
          )
        );
      return interaction.showModal(modal);
    }
  }
}

async function handleModal(client, interaction) {
  const id = interaction.customId;
  const db = client.db;

  if (id === 'ticket_rename_modal') {
    const newName = interaction.fields.getTextInputValue('new_name').trim();
    await interaction.deferReply({ ephemeral: true });
    try {
      await interaction.channel.setName(newName.slice(0, 90));
      await interaction.editReply({ embeds: [successEmbed('Ticket renommé avec succès.')] });
    } catch (err) {
      await interaction.editReply({ embeds: [errorEmbed('Impossible de renommer ce salon (nom invalide ou permissions manquantes).')] });
    }
    return;
  }

  if (id === 'ticket_add_member_modal' || id === 'ticket_remove_member_modal') {
    const raw = interaction.fields.getTextInputValue('user_id').replace(/[<@!>]/g, '').trim();
    await interaction.deferReply({ ephemeral: true });
    let member;
    try {
      member = await interaction.guild.members.fetch(raw);
    } catch {
      return interaction.editReply({ embeds: [errorEmbed('Membre introuvable. Utilise l\'ID Discord du membre.')] });
    }

    if (id === 'ticket_add_member_modal') {
      await interaction.channel.permissionOverwrites
        .edit(member.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        })
        .catch(() => null);
      await interaction.editReply({ embeds: [successEmbed(`${member} a été ajouté au ticket.`)] });
    } else {
      await interaction.channel.permissionOverwrites.delete(member.id).catch(() => null);
      await interaction.editReply({ embeds: [successEmbed(`${member} a été retiré du ticket.`)] });
    }
    return;
  }
}
