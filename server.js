var config = require('config');
var express = require('express');
var bodyParser = require('body-parser');

var app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/toirc', function(req, res){
  console.log('Got incoming msg to IRC: ', req.body);
  res.status(200).end();
});

var server = app.listen(config.server.port, function() {
  console.log('Listening on port ' + config.server.port);
})
