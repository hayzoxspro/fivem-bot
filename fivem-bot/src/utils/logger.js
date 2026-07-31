'use strict';

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

module.exports = {
  info: (...args) => console.log(`[${timestamp()}] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${timestamp()}] [WARN]`, ...args),
  error: (...args) => console.error(`[${timestamp()}] [ERROR]`, ...args),
  success: (...args) => console.log(`[${timestamp()}] [OK]`, ...args)
};
