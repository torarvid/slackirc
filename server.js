var config = require('config');
var express = require('express');
var bodyParser = require('body-parser');
var l = require('./lib/log');

var app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/toirc', function(req, res){
  l.debug('Got incoming msg to IRC: ', req.body);
  res.status(200).end();
});

var server = app.listen(config.server.port, function() {
  l.info('Listening on port ' + config.server.port);
});
