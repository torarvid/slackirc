var impl = require('winston');

var logger = new impl.Logger({
  transports: [
    new (impl.transports.File)({
      filename: 'all.log',
      handleExceptions: true,
      level: 'debug',
      timestamp: true,
      json: false
    }),
    new (impl.transports.Console)({
      level: 'debug',
      colorize: true,
      timestamp: true,
      handleExceptions: true
    })
  ]
});

module.exports = logger;
