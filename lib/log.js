var impl = require('winston');

function NamedLogger(name, options) {
  impl.Logger.call(this, options);
  this.name = name;
}

NamedLogger.prototype = Object.create(impl.Logger.prototype);

NamedLogger.prototype.log = function() {
  var args = Array.prototype.slice.call(arguments, 0);
  args[1] = this.name + ': ' + args[1];
  impl.Logger.prototype.log.apply(this, args);
};

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
