var fs = require('fs');
var l = require('./log')('db');
var _ = require('./toolbelt');
var q = require('q');
var cfg = require('config');

var db = (function() {
  'use strict';

  var store = {serverConfigs: {}};
  var serverConfigMap = {};
  var clients = {};
  var users = {};

  var db = {
    load: function () {
      var filename = __dirname + '/../db/db.json';
      if (fs.existsSync(filename)) {
        l.info('Database file exists. Loading it...');
        store = require(filename);
        generateServerConfigMaps(store.serverConfigs);
      } else {
        l.info('No database file. Tell me to set some up..');
      }
    },

    save: function () {
      var dirname = __dirname + '/../db';
      var filename = dirname + '/db.json';
      ensureExists(dirname)
      .then(function() {
        fs.writeFile(filename, JSON.stringify(store, null, 2), function(e) {
          if (e)
            l.error('Couldn\'t save database: %s', e.toString());
        });
      })
      .done();
    },

    getOrAddServerConfig: function (host, port) {
      var key = host + ':' + port;
      if (!_.has(store.serverConfigs, key)) {
        l.verbose('Adding server config for host %s', key);
        store.serverConfigs[key] = {
          host: host,
          port: port,
          rejectUnauthorized: cfg.ircServers.rejectUnauthorizedTlsCerts,
          channelMap: {}
        };
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

    getOrAddClient: function (slackChannel, userId, clientCreator) {
      var deferred = q.defer();
      var serverConfig = this.getServerConfig(slackChannel);
      var key = serverConfig.host + ':' + serverConfig.port + '::' + userId;
      if (_.has(clients, key)) {
        var valueOrPromise = clients[key];
        if (q.isPromise(valueOrPromise)) {
          return valueOrPromise;
        }
        deferred.resolve(valueOrPromise);
        return deferred.promise;
      }
      clients[key] = deferred.promise;
      clientCreator()
      .then(function(client) {
        l.debug('ADD client %s', key);
        clients[key] = client;
        deferred.resolve(client);
      })
      .done();
      return deferred.promise;
    },

    getClientsOnSameIrcChannel: function(client, channel) {
      return _.filter(clients, function(c) {
        return c.connectionOptions.host === client.connectionOptions.host
          && c.connectionOptions.port === client.connectionOptions.port
          && _.contains(c.joinedChannels, channel);
      });
    },

    getSlackSenderOnIrcChannel: function(client, channel) {
      var clientsOnSameIrcChannel = this.getClientsOnSameIrcChannel(client, channel);
      return _.first(clientsOnSameIrcChannel);
    },

    cacheUsers: function (members) {
      members.forEach(function(member) {
        users[member.id] = member;
      });
    },

    getUser: function (slackId) {
      return users[slackId];
    },

    getUsers: function() {
      return users;
    },

    getSlackChannel: function(client, ircChannel) {
      var serverKey = client.connectionOptions.host + ':' + client.connectionOptions.port;
      var serverConfig = store.serverConfigs[serverKey];
      return _.findKey(serverConfig.channelMap, function(irc) {
        return (irc === ircChannel);
      });
    }
  };

  var generateServerConfigMaps = function (serverConfigs) {
    _.values(serverConfigs).forEach(generateServerConfigMap);
  };

  var generateServerConfigMap = function(config) {
    _.forOwn(config.channelMap, function(__, slackChannel) {
      serverConfigMap[slackChannel] = config;
    });
  };

  var ensureExists = function (path, mask) {
    var deferred = q.defer();
    fs.mkdir(path, mask || '0777', function(err) {
      if (err && err.code !== 'EEXIST')
        deferred.reject(err);
      else
        deferred.resolve();
    });
    return deferred.promise;
  };

  return db;

}());

module.exports = db;
