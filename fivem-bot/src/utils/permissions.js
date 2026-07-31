'use strict';

const { PermissionsBitField } = require('discord.js');

/** Un membre est considéré "staff/admin" s'il a la permission ManageGuild ou Administrator. */
function isStaff(member) {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild);
}

/**
 * Vérifie qu'un membre a l'un des rôles requis. Si la liste est vide, tout le monde est autorisé
 * (sauf si `requireStaffFallback` est vrai, auquel cas il faut être staff).
 */
function hasAnyRole(member, roleIds = [], requireStaffFallback = false) {
  if (!roleIds || roleIds.length === 0) {
    return requireStaffFallback ? isStaff(member) : true;
  }
  if (isStaff(member)) return true;
  return roleIds.some((id) => member.roles.cache.has(id));
}

function canOpenTicket(member, guildConfig) {
  return hasAnyRole(member, guildConfig.permissions.ticketOpenRoleIds, false);
}

function canManageTicket(member, category) {
  if (isStaff(member)) return true;
  const staffRoles = (category && category.staffRoleIds) || [];
  return staffRoles.some((id) => member.roles.cache.has(id));
}

function canViewLogs(member, guildConfig) {
  return hasAnyRole(member, guildConfig.permissions.logsViewRoleIds, true);
}

module.exports = { isStaff, hasAnyRole, canOpenTicket, canManageTicket, canViewLogs };
