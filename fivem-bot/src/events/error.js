'use strict';

const logger = require('../utils/logger');

module.exports = {
  name: 'error',
  async execute(client, error) {
    logger.error('Erreur client Discord :', error);
  }
};
