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

var createClientConnections = function() {
  _.forOwn(db.allServerConfigs(), function(config) {
    _.forOwn(config.channelMap, function(ircChannel, slackChannel) {
      slack.getChannelInfo({channel: slackChannel})
      .then(function(info) {
        if (info && info.channel) {
          info.channel.members.forEach(function(member) {
            var clientCreator = function() {
              var user = db.getUser(member);
              if (!user)
                l.warn('User %s not found', member);
              console.log(config);
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
            db.getOrAddClient(info.channel.id, member, clientCreator)
            .then(function(client) {
              return ezirc.join(client, ircChannel);
            })
            .done();
          });
        }
      })
      .done();
    });
  });
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
