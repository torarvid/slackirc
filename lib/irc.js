var Irc = require('slate-irc');
var _ = require('./toolbelt');
var q = require('q');
var net = require('net');
var l = require('./log')('Irc');

var clientFunc = function(options) {
  if (!_.hasAll(options, 'host', 'port', 'nick', 'channels'))
    return q.reject('Need to provide host, port, nick and channels');
  l.debug('Connecting: ');
  var stream = net.connect({host: options.host, port: options.port});
  l.debug('Creating IRC client');
  var client = Irc(stream);
  client.on('error', function(e) {
    l.error('IRC ERROR: ', e);
  });
  if (options.password)
    client.pass(options.password);
  l.debug('Setting nick');
  client.nick(options.nick);
  l.debug('Joining channels ', options.channels);
  for (var i = 0, len = options.channels.length; i < len; i++)
    client.join(options.channels[i]);
  return q.resolve(client);
};

module.exports.client = clientFunc;
