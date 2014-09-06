var db = require('./db');
var _ = require('./toolbelt');
var slack = require('./slack');
var l = require('./log');

var SlackDispatcher = (function() {
  'use strict';

  var SlackDispatcher = {
    postMessage: function(client, options) {
      l.debug('Message from IRC');
      var otherClientsInChannel = db.getClientsOnSameIrcChannel(client, options.fromChannel);
      var nickBelongsToSlackUser = _.find(otherClientsInChannel, function(ch) {
        return ch.nickName === options.fromUser;
      });
      if (nickBelongsToSlackUser)
        return;
      var slackChannel = _.findKey(client.channels, function(c) {
        return c === options.fromChannel;
      });
      slack.postMessage({channel: slackChannel, username: options.fromUser, text: options.message});
    }
  };

  return SlackDispatcher;

}());

module.exports = SlackDispatcher;
