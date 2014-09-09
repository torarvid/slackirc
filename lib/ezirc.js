var EzIrc  = (function() {
  'use strict';

  var irc = require('slate-irc');
  var tls = require('tls');
  var net = require('net');
  var q = require('q');
  var _ = require('./toolbelt');
  var l = require('./log')('EzIrc');

  var EzIrc = {
    connect: function(options) {
      l.verbose('Connecting')
      var deferred = q.defer();
      connectToHost(options)
      .then(function(stream) {
        var client = irc(stream);
        client.use(endwho());
        client.use(channelModeIs());
        client.use(endBanList());
        client.promises = {};
        client.joinedChannels = [];
        client.connectionOptions = options;
        addPromise(client, 'connect', deferred);
        client.on('errors', onIrcError);
        client.on('welcome', onIrcWelcome);
        client.on('nick', function(e) {client.currentNick = e.new;});
        client.on('join', onIrcJoin);
        client.on('mode', onIrcMode);
        client.on('endwho', onIrcEndWho);
        client.on('data', onIrcData);
        return client;
      })
      .then(function(client) {
        if (options.serverPassword)
          client.pass(options.serverPassword);
        setNick(client, options.nick);
        client.user(options.userid || options.nick || 'user', options.username);
        return client;
      })
      .done();
      return deferred.promise;
    },

    join: function(client, channel) {
      if (_.contains(client.joinedChannels, channel))
        return q(client);
      var deferred = q.defer();
      var joinPromise = addPromise(client, 'join');
      client.join(channel);
      joinPromise
      .then(function(client) {
        return mode(client, channel, '');
      })
      .then(function(client) {
        var whoPromise = addPromise(client, 'who');
        client.write('WHO ' + channel + '\r\n');
        return whoPromise;
      })
      .then(function(client) {
        var chanModePromise = addPromise(client, 'mode');
        client.mode(channel, 'b');
        return chanModePromise;
      })
      .then(function(client) {
        client.joinedChannels.push(channel);
        deferred.resolve(client);
      })
      .done();

      return deferred.promise;
    },

    onMessage: function (client, callback) {
      client.on('message', function(event) {
        callback(client, event);
      })
    }
  };

  var endwho = function() {
    return function(irc) {
      irc.on('data', function(msg){
        if ('RPL_ENDOFWHO' != msg.command) return;
        var e = {};
        e.msg = msg.trailing;
        irc.emit('endwho', e);
      });
    }
  };

  var channelModeIs = function() {
    return function(irc){
      irc.on('data', function(msg){
        if ('RPL_CHANNELMODEIS' != msg.command) return;
        var params = msg.params.split(' ');
        var e = {};
        e.target = params[0];
        e.mode = params[1] || msg.trailing;
        e.client = params[2];
        irc.emit('mode', e);
      });
    }
  }

  var endBanList = function() {
    return function(irc){
      irc.on('data', function(msg){
        if ('RPL_ENDOFBANLIST' != msg.command) return;
        var params = msg.params.split(' ');
        var e = {};
        e.target = params[0];
        e.mode = params[1] || msg.trailing;
        e.client = params[2];
        irc.emit('mode', e);
      });
    }
  }

  var addPromise = function(client, promiseType, deferred) {
    deferred = deferred || q.defer()
    if (!_.has(client.promises, promiseType))
      client.promises[promiseType] = [];
    client.promises[promiseType].push(deferred);
    return deferred.promise;
  }

  var resolvePromise = function(client, promiseType) {
    var arr = client.promises[promiseType];
    if (arr) {
      var promise = arr.shift();
      if (promise) promise.resolve(client);
    }
  }

  var connectToHost = function(options) {
    var deferred = q.defer();
    var connector = options.useTLS ? tls : net;
    var stream = connector.connect(options, function(err) {
      if (err)
        deferred.reject(err);
      deferred.resolve(stream);
    });
    return deferred.promise;
  }

  var setNick = function(client, nick) {
    client.desiredNick = nick || client.desiredNick;
    if (!client.nickAttempts)
      client.nickAttempts = 0;
    if (client.nickAttempts > 1)
      client.nick(client.desiredNick + (client.nickAttempts - 1));
    else if (client.nickAttempts == 1)
      client.nick(client.desiredNick + '_');
    else
      client.nick(client.desiredNick);
    client.nickAttempts++;
  }

  var onIrcError = function(e) {
    var client = this;
    switch(e.cmd) {
      case 'ERR_NICKNAMEINUSE':
        setNick(client);
        break;
    }
  }

  var onIrcData = function(msg) {
    l.silly('Got incoming message %j', msg, {});
  };

  var onIrcWelcome = function(e) {
    var client = this;
    client.currentNick = e;
    initializeConnection(client)
    .then(function(client) {
      resolvePromise(client, 'connect');
      return client;
    })
    .done();
  }

  var onIrcJoin = function(e) {
    var client = this;
    if (e.nick === client.currentNick)
      resolvePromise(client, 'join');
  }

  var onIrcMode = function(e) {
    var client = this;
    resolvePromise(client, 'mode');
  }

  var onIrcEndWho = function(e) {
    var client = this;
    resolvePromise(client, 'who');
  }

  var initializeConnection = function(client) {
    var deferred = q.defer();
    mode(client, client.currentNick, '+i')
    .then(function(client) {
      client.whois(client.currentNick, function(e) {
        deferred.resolve(client);
      });
    })
    return deferred.promise;
  }

  var mode = function(client, target, flags) {
    var chanModePromise = addPromise(client, 'mode');
    client.mode(target, flags);
    return chanModePromise;
  }

  String.prototype.endsWith = function(suffix) {
      return this.indexOf(suffix, this.length - suffix.length) !== -1;
  };

  return EzIrc;
}());

module.exports = EzIrc;
