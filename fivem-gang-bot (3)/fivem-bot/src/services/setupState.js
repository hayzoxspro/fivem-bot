'use strict';

// État temporaire du wizard /setup, le temps que l'admin clique sur les étapes suivantes.
// Pas besoin de le stocker en base : si le bot redémarre en plein milieu, l'admin relance /setup.
const state = new Map();

function get(userId) {
  return state.get(userId) || {};
}
function set(userId, patch) {
  state.set(userId, { ...get(userId), ...patch });
}
function clear(userId) {
  state.delete(userId);
}

module.exports = { get, set, clear };
