var config = require('config');
var express = require('express');
var bodyParser = require('body-parser');
var ircdispatcher = require('./lib/ircdispatcher');
var messageparser = require('./lib/messageparser');
var l = require('./lib/log')('Server');
var db = require('./lib/db');

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

var server = app.listen(config.server.port, function() {
  db.load();
  l.info('Listening on port ' + config.server.port);
});
