var irc = require('./irc');
var e = require('./error');
var _ = require('./toolbelt');
var q = require('q');
var l = require('./log');

var IrcDispatcher = (function() {
  'use strict';

  var serverConfigs = {}; // key is host:port (each can have many slack/irc channel mappings)
  var serverConfigMap = {}; // key is slack channel id
  var clients = {};

  var IrcDispatcher = {
    postMessage: function (message) {
      var deferred = q.defer();
      if (!_.has(serverConfigMap, message.channel_id)) {
        deferred.reject(e.httpError(400, 'No config for IRC channel mapping'));
        return;
      }
      var clientKey = message.channel_id + '::' + message.user_id;
      if (!_.has(clients, clientKey)) {
        addClient(serverConfigMap[message.channel_id], message, deferred)
        .then(function(client) {
          clients[clientKey] = client;
          internalPostMessage(client, message, deferred);
        });
      } else {
        internalPostMessage(clients[clientKey], message, deferred);
      }
      return deferred.promise;
    },

    addServerConfig: function (options) {
      if (!_.hasAll(options, 'host', 'port', 'slack_channel_id', 'irc_channel_id'))
        return q.reject(e.httpError(400));
      var serverKey = options.host + ':' + options.port;
      if (!_.has(serverConfigs, serverKey))
        serverConfigs[serverKey] = {host: options.host, port: options.port, channelMap: {}};
      var serverConfig = serverConfigs[serverKey];
      serverConfig.channelMap[options.slack_channel_id] = options.irc_channel_id;
      serverConfigMap[options.slack_channel_id] = serverConfig;
    }
  };

  var addClient = function(serverConfig, options, deferred) {
    l.info('Connecting to IRC server %s:%s for nick %s',
      serverConfig.host, serverConfig.port, options.user_name);
    return irc.client({
      host: serverConfig.host,
      port: serverConfig.port,
      nick: options.user_name,
      channels: _.values(serverConfig.channelMap)
    })
    .then(function(client) {
      client.serverConfig = serverConfig;
      return client;
    }, function(e) {
      deferred.reject(e);
    });
  };

  var internalPostMessage = function(client, message, deferred) {
    var channel = getChannel(client, message);
    client.send(channel, message.text);
    deferred.resolve();
  }

  var getChannel = function(client, options) {
    return client.serverConfig.channelMap[options.channel_id];
  }

  // TODO REMOVE
  IrcDispatcher.addServerConfig({
    host: 'localhost',
    port: 6667,
    slack_channel_id: 'C02HR72AS',
    irc_channel_id: '#channel1'
  });

  return IrcDispatcher;

}());

module.exports = IrcDispatcher;
