var irc = require('./irc');
var e = require('./error');
var _ = require('./toolbelt');
var q = require('q');
var l = require('./log')('IrcDispatcher');
var slack = require('./slack');
var db = require('./db');

var IrcDispatcher = (function() {
  'use strict';

  var IrcDispatcher = {
    postMessage: function (message) {
      var deferred = q.defer();
      if (message.user_id === 'USLACKBOT') {
        l.debug('Ignoring message from slackbot');
        deferred.resolve({sent: false});
        return deferred.promise;
      }
      var serverConfig = db.getServerConfig(message.channel_id);
      if (!serverConfig) {
        var msg = 'No config for IRC channel mapping';
        l.warn(msg);
        deferred.reject(e.httpError(400, msg));
        return deferred.promise;
      }
      l.debug('Serverconfig %j', serverConfig, {});
      var clientCreator = function() {
        return irc.client(serverConfig, {nick: message.user_name})
        .fail(function(e) {
          deferred.reject(e);
        });
      };
      db.getOrAddClient(message.channel_id, message.user_id, clientCreator, function(client) {
        internalPostMessage(client, message, deferred);
      });
      return deferred.promise;
    },

    addServerConfig: function (options) {
      if (!_.hasAll(options, 'host', 'port', 'slack_channel_id', 'irc_channel_id'))
        return q.reject(e.httpError(400));
      l.info('Adding server configuration for channel \'%s\''
        , options.slack_channel_id);
      var serverConfig = db.getOrAddServerConfig(options.host, options.port);
      db.mapChannels(serverConfig, options.slack_channel_id, options.irc_channel_id);
    }
  };

  var internalPostMessage = function(client, message, deferred) {
    var channel = irc.getOrJoinChannel(client, message);
    client.send(channel, message.text);
    deferred.resolve({sent: true});
  };

  return IrcDispatcher;

}());

module.exports = IrcDispatcher;
