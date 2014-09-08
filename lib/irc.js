var ircImpl = require('slate-irc');
var _ = require('./toolbelt');
var q = require('q');
var net = require('net');
var tls = require('tls');
var l = require('./log')('Irc');
var config = require('config');
var slackdispatcher = require('slackdispatcher');

var Irc = (function() {
  'use strict';

  var Irc = {
    client: function(serverConfig, options) {
      l.info('Connecting to IRC server %s:%s for nick %s',
        serverConfig.host, serverConfig.port, options.nick);
      var channels = serverConfig.channelMap;
      return connectToHost({
        host: serverConfig.host,
        port: serverConfig.port,
        useTLS: serverConfig.useTLS,
        tlsRejectUnauthorized: serverConfig.rejectUnauthorized
      })
      .then(function(stream) {
        return createIrcClient(stream);
      })
      .then(function(client) {
        var deferred = q.defer();
        if (serverConfig.password) {
          l.debug('Setting server password');
          client.pass(serverConfig.password, function(e, f) {
            l.debug('Password callback %j %j', e, f, {});
            deferred.resolve(client);
          });
        } else {
          deferred.resolve(client);
        }
        return deferred.promise;
      })
      .then(function(client) {
        l.debug('Try set nick');
        return setNick(client, options.nick);
      })
      .then(function(client) {
        if (options.userId)
          setUser(client, options.userId || options.nick, options.userName);
        l.verbose('Joining channels %j', options.channels, {});
        for (var i = 0, len = options.channels.length; i < len; i++)
          client.join(options.channels[i]);
        l.debug('laskdjlkjsdlkjcreateIrcClient');
        client.serverConfig = serverConfig;
        client.channels = channels;
        return client;
      }, function(e) {
        throw e;
      });
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

  var connectToHost = function(options) {
    if (!_.hasAll(options, 'host', 'port'))
      return q.reject('Need to provide host and port');
    var deferred = q.defer();
    l.info('Connecting to %s:%s', options.host, options.port);
    var connector = options.useTLS ? tls : net;
    var rejectUnauthorized = _.isUndefined(options.tlsRejectUnauthorized)
      ? config.ircServers.rejectUnauthorizedTlsCerts
      : options.tlsRejectUnauthorized;
    var stream = tls.connect({
      host: options.host,
      port: options.port,
      rejectUnauthorized: rejectUnauthorized
    }, function() {
      validateTlsStream(stream);
      l.debug('Creating IRC client to the network stream');
      deferred.resolve(stream);
    });
    return deferred.promise;
  };

  var validateTlsStream = function(stream) {
    if (stream.authorized
      || stream.authorizationError === 'DEPTH_ZERO_SELF_SIGNED_CERT'
      || stream.authorizationError === 'CERT_HAS_EXPIRED'
      || stream.authorizationError === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      if (stream.authorizationError === 'CERT_HAS_EXPIRED') {
        l.info('Connecting to server with expired certificate');
      }
    } else {
      l.error('[SSL-Error]' + stream.authorizationError);
    }
  };

  var createIrcClient = function(stream) {
    var client = ircImpl(stream);
    client.on('errors', function(e) {
      l.error('Error: %j', e, {});
      switch(e.cmd) {
        case 'ERR_NICKNAMEINUSE':
          setNick(client, client.desiredNick + '_');
          break;
      }
    });
    client.on('data', onIrcData);
    client.on('message', onIrcMessage);
    return client;
  }

  var onIrcData = function(msg) {
    l.debug('Got incoming message %j', msg, {});
  };

  var onIrcMessage = function(client, event) {
    slackdispatcher.postMessage(client, {
      fromUser: event.from,
      fromChannel: event.to,
      message: event.message
    });
  };

  var setNick = function(client, nick) {
    var deferred = q.defer();
    l.verbose('Setting nick %s', nick);
    client.desiredNick = nick;
    client.nick(nick);
    var onNick = function(e) {
      l.verbose('Nick changed from %s to %s', e.nick, e.new);
      client.nickName = e.new;
      deferred.resolve(client);
    };
    client.on('nick', onNick);
    return deferred.promise;
  };

  var setUser = function(client, id, name) {
    l.verbose('Setting user id:%s, name:%s', id, name);
    var onUser = function(e) {
      l.verbose('User set: %j', e, {});
      client.removeListener('user', onUser);
    };
    client.on('user', onUser);
    client.user(id, name);
  };

  return Irc;

}());

module.exports = Irc;
