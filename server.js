var config = require('config');
var express = require('express');
var bodyParser = require('body-parser');
var ircdispatcher = require('./lib/ircdispatcher');
var slackdispatcher = require('./lib/slackdispatcher');
var messageparser = require('./lib/messageparser');
var l = require('./lib/log')('Server');
var db = require('./lib/db');
var slack = require('./lib/slack');
var _ = require('./lib/toolbelt');
var ezirc = require('./lib/ezirc');
var q = require('q');

var app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/toirc', function(req, res){
  l.debug('Got incoming msg to IRC: ', req.body);
  messageparser.parseIrcMessage(req.body)
  .then(function(message) {
    return ircdispatcher.postMessage(message);
  })
  .then(function(result) {
    if (result && result.sent)
      l.verbose('IRC message sent to IRC server');
    res.status(200).end();
  }, function error (e) {
    if (e.name === 'HttpError') {
      // Send 200 so that Slack will display the message
      res.status(200).json({text: 'Error: ' + e.message});
    } else {
      l.error('%s\nStack: "%s"', e.toString(), e.stack);
      res.status(500);
    }
  })
  .done();
});

app.post('/ircsetup', function(req, res) {
  l.debug('Got IRC setup message from Slack');
  messageparser.parseIrcSetupMessage(req.body)
  .then(function(message) {
    if (message.text.length === 0 || message.text.indexOf('help') >= 0) {
      res.status(200).send('Try for instance "/ircsetup ssl=true server=irc.mozilla.org:6697 '
        + 'password=monkeybusiness channel=#development"');
      return;
    }
    var existing = db.getServerConfig(message.channel_id);
    if (existing) {
      res.status(200).send('Channel is already connected to IRC');
      return;
    }
    var parts = message.text.split(' ');
    options = {channelMap: {}};
    parts.forEach(function(part) {
      var splitPos = part.indexOf('=');
      if (splitPos < 1)
        return;
      var key = part.substring(0, splitPos);
      var value = part.substring(splitPos + 1);
      if (key === 'ssl') {
        options.useTLS = (value === 'true');
      } else if (key === 'server') {
        var hostSpec = value.split(':');
        options.host = hostSpec[0];
        options.port = hostSpec.length > 1 ? hostSpec[1] : "6667";
      } else if (key === 'password') {
        options.serverPassword = value;
      } else if (key === 'channel') {
        options.channelMap[message.channel_id] = value;
      }
    });
    if (!_.hasAll(options, 'host', 'port') || options.channelMap.length < 1) {
      res.status(200).send('Must specify at least host:port and an irc channel name to map to');
      return;
    }
    var serverConfig = db.getOrAddServerConfig(options.host, options.port);
    _.defaults(serverConfig, options);
    _.forOwn(options.channelMap, function(ircChannel, slackChannel) {
      db.mapChannels(serverConfig, slackChannel, ircChannel);
    });
    createClientConnection(serverConfig)
    .then(function() {
      res.status(200).send('Setup and connection was successful');
    }, function(err) {
      res.status(200).send('ERROR! Message was: ', err.toString());
    })
    .done();
  })
  .done();
});

var createClientConnections = function() {
  _.forOwn(db.allServerConfigs(), createClientConnection);
};

var createClientConnection = function(config) {
  var all = [];
  _.forOwn(config.channelMap, function(ircChannel, slackChannel) {
    var promise = slack.getChannelInfo({channel: slackChannel})
    .then(function(info) {
      if (info && info.channel) {
        connectSlackChannelToIrc(config, info.channel, ircChannel);
      }
    })
    .done();
    all.push(promise);
  });
  return q.all(all);
};

var connectSlackChannelToIrc = function(config, slackChannel, ircChannel) {
  var all = [];
  slackChannel.members.forEach(function(member) {
    var promise = db.getOrAddClient(slackChannel.id, member, clientCreator(config, member))
    .then(function(client) {
      return ezirc.join(client, ircChannel);
    })
    .done();
    all.push(promise);
  });
  return q.all(all);
};

var clientCreator = function(config, member) {
  return function() {
    var user = db.getUser(member);
    if (!user)
      l.warn('User %s not found', member);
    var options = _.clone(config);
    options = _.extend(options, {
      nick: user.name,
      userid: user.name,
      username: user.real_name
    });
    return ezirc.connect(options)
    .then(function(client) {
      ezirc.onMessage(client, slackdispatcher.postMessage);
      return client;
    });
  };
};

var startServer = function() {
  app.listen(config.server.port, function() {
    l.info('Listening on port ' + config.server.port);
  });
};

db.load();
slack.getUserList()
.then(db.cacheUsers)
.then(function() {
  createClientConnections();
  startServer();
})
.done();
