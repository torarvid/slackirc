var config = require('config');
var express = require('express');
var bodyParser = require('body-parser');
var ircdispatcher = require('./lib/ircdispatcher');
var messageparser = require('./lib/messageparser');
var l = require('./lib/log')('Server');

var app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/toirc', function(req, res){
  l.debug('Got incoming msg to IRC: ', req.body);
  messageparser.parseIrcMessage(req.body)
  .then(function(message) {
    l.debug('IRC message parsed');
    return ircdispatcher.postMessage(message);
  })
  .then(function() {
    l.verbose('IRC message sent to IRC server');
    res.status(200).end();
  }, function error (e) {
    if (e.name !== 'HttpError')
      l.error('%s\nStack: "%s"', e.toString(), e.stack);
    res.status(e.statusCode);
  })
  .done();
});

var server = app.listen(config.server.port, function() {
  l.info('Listening on port ' + config.server.port);
});
