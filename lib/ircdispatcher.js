var irc = require('./irc');
var e = require('./error');
var _ = require('./toolbelt');
var q = require('q');
var l = require('./log')('IrcDispatcher');
var Slack = require('./slack');
var db = require('./db');

var slack = new Slack();

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
        return addClient(serverConfig, message, deferred)
        .then(function(client) {
          return client;
        }, function(e) {
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

  var addClient = function(serverConfig, options, deferred) {
    l.info('Connecting to IRC server %s:%s for nick %s'
      , serverConfig.host, serverConfig.port, options.user_name);
    var channels = serverConfig.channelMap;
    return irc.client({
      host: serverConfig.host,
      port: serverConfig.port,
      nick: options.user_name,
      channels: _.values(channels)
    })
    .then(function(client) {
      client.serverConfig = serverConfig;
      client.channels = channels;
      client.on('data', onIrcData);
      client.on('message', onIrcMessage);
      return client;
    }, function(e) {
      deferred.reject(e);
    });
  };

  var internalPostMessage = function(client, message, deferred) {
    var channel = getOrJoinChannel(client, message);
    client.send(channel, message.text);
    deferred.resolve({sent: true});
  };

  var getOrJoinChannel = function(client, options) {
    var slackChannel = options.channel_id;
    var ircChannel = client.serverConfig.channelMap[slackChannel];
    if (!_.contains(_.values(client.channels), ircChannel)) {
      l.verbose('Joining channel %s', ircChannel);
      client.join(ircChannel);
      client.channels[slackChannel] = ircChannel;
    }
    return ircChannel;
  };

  var onIrcData = function(msg) {
    l.silly('Got incoming message %j', msg, {});
  };

  var onIrcMessage = function(event) {
    var client = this;
    var fromUser = event.from;
    var ircChannel = event.to;
    var slackChannel = _.findKey(client.channels, function(c) { return c === ircChannel; });
    slack.postMessage({channel: slackChannel, username: fromUser, text: event.message});
  };

  return IrcDispatcher;

}());

module.exports = IrcDispatcher;
