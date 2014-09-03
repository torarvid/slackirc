var impl = require('winston');

function NamedLogger(name, options) {
  impl.Logger.call(this, options);
  this.name = name;
}

NamedLogger.prototype = Object.create(impl.Logger.prototype);

NamedLogger.prototype.log = function() {
  arguments[1] = this.name + ': ' + arguments[1];
  impl.Logger.prototype.log.apply(this, arguments);
}

var newLogger = function(name) {
  return new NamedLogger(name, {
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
};

module.exports = newLogger;
