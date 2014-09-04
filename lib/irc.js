var ircImpl = require('slate-irc');
var _ = require('./toolbelt');
var q = require('q');
var net = require('net');
var l = require('./log')('Irc');

var Irc = (function() {
  'use strict';

  var Irc = {
    client: function(options) {
      if (!_.hasAll(options, 'host', 'port', 'nick', 'channels'))
        return q.reject('Need to provide host, port, nick and channels');

      l.info('Connecting to %s:%s', options.host, options.port);
      var stream = net.connect({host: options.host, port: options.port});

      l.debug('Creating IRC client to the network stream');
      var client = ircImpl(stream);
      client.on('error', function(e) {
        l.error('Irc error: %s', e.toString());
      });

      if (options.password)
        client.pass(options.password);
      setNick(client, options.nick);
      l.verbose('Joining channels %j', options.channels, {});
      for (var i = 0, len = options.channels.length; i < len; i++)
        client.join(options.channels[i]);

      return q.resolve(client);
    },

    getOrJoinChannel: function(client, options) {
      var slackChannel = options.channel_id;
      var ircChannel = client.serverConfig.channelMap[slackChannel];
      if (!_.contains(_.values(client.channels), ircChannel)) {
        l.verbose('Joining channel %s', ircChannel);
        client.join(ircChannel);
        client.channels[slackChannel] = ircChannel;
      }
      return ircChannel;
    }
  };

  var setNick = function(client, nick) {
    l.verbose('Setting nick %s', nick);
    client.nick(nick);
    var onNick = function(e) {
      l.verbose('Nick changed from %s to %s', e.nick, e.new);
      client.nickName = e.new;
      client.removeListener('nick', onNick);
    };
    client.on('nick', onNick);
  };

  return Irc;

}());

module.exports = Irc;
