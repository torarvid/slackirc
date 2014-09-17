var _ = require('./toolbelt');
var db = require('./db');
var e = require('./error');
var ezirc = require('./ezirc');
var l = require('./log')('IrcDispatcher');
var q = require('q');
var slack = require('./slack');

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
        var user = db.getUser(message.user_id);
        if (!user)
          l.warn('User %s not found', message.user_name);
        var options = _.extend(serverConfig, {
          nick: user.name,
          userid: user.name,
          username: user.real_name
        });
        return ezirc.connect(serverConfig, {nick: message.user_name})
        .fail(function(e) {
          deferred.reject(e);
        });
      };
      var slackChannel = message.channel_id;
      var ircChannel = serverConfig.channelMap[slackChannel];
      db.getOrAddClient(message.channel_id, message.user_id, clientCreator)
      .then(function(client) {
        return ezirc.joinIfNecessary(client, ircChannel);
      })
      .then(function(client) {
        var converted = convertMessage(message.text);
        l.debug('Sending message: [%s]', converted, {});
        client.send(ircChannel, converted);
        deferred.resolve({sent: true});
      })
      .done();
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

  var convertMessage = function(message) {
    var newValue = message.replace(/<@(U\w+)>/g, function(match, uid) {
      var user = db.getUser(uid);
      return user ? user.name : match;
    });
    return _.unescape(newValue);
  };

  return IrcDispatcher;

}());

module.exports = IrcDispatcher;
