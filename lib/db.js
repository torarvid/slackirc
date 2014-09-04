var fs = require('fs');
var l = require('./log')('db');
var _ = require('./toolbelt');

var db = (function() {
  'use strict';

  var store = {};
  var serverConfigMap = {};
  var clients = {};

  var db = {
    load: function () {
      var filename = __dirname + '/../db/db.json';
      if (fs.existsSync(filename)) {
        l.info('Database file exists. Loading it...');
        store = require(filename);
        generateServerConfigMap(store.serverConfigs);
      } else {
        l.info('No database file. Tell me to set some up..');
      }
    },

    save: function () {
      var filename = __dirname + '/../db/db.json';
      fs.writeFile(filename, JSON.stringify(store, null, 2), function(e) {
        if (e)
          l.error('Couldn\'t save database: %s', e.toString());
      });
    },

    getOrAddServerConfig: function (host, port) {
      var key = host + ':' + port;
      if (!_.has(store.serverConfigs, key)) {
        l.verbose('Adding server config for host %s', key);
        store.serverConfigs[key] = {host: host, port: port, channelMap: {}};
        this.save();
      }
      return store.serverConfigs[key];
    },

    allServerConfigs: function () {
      return store.serverConfigs;
    },

    getServerConfig: function (slackChannelId) {
      return serverConfigMap[slackChannelId];
    },

    mapChannels: function (serverConfig, slackChannel, ircChannel) {
      serverConfig.channelMap[slackChannel] = ircChannel;
      serverConfigMap[slackChannel] = serverConfig;
      this.save();
    },

    getOrAddClient: function (slackChannel, userId, clientCreator, callback) {
      var key = slackChannel + '::' + userId;
      if (_.has(clients, key)) {
        callback(clients[key]);
        return;
      }
      var self = this;
      clientCreator()
      .then(function(client) {
        clients[key] = client;
        callback(client);
        self.save();
      })
      .done();
    },

    getClientsOnSameIrcChannel: function(client, channel) {
      return _.filter(clients, function(c) {
        return (c.serverConfig === client.serverConfig) && _.has(c.channels, channel);
      });
    }
  };

  var generateServerConfigMap = function (serverConfigs) {
    _.values(serverConfigs).forEach(function(config) {
      _.forOwn(config.channelMap, function(__, slackChannel) {
        serverConfigMap[slackChannel] = config;
      });
    });
  };

  return db;

}());

module.exports = db;
