var db = require('./db');
var _ = require('./toolbelt');
var slack = require('./slack');
var l = require('./log')('SlackDispatcher');

var SlackDispatcher = (function() {
  'use strict';

  var SlackDispatcher = {
    postMessage: function(client, options) {
      var ircChannel = options.to;
      var senderClient = db.getSlackSenderOnIrcChannel(client, ircChannel);
      if (senderClient !== client) {
        l.debug('Not sending to slack because it didn\'t come from designated sender'
          , options.from);
        return;
      }
      var username = options.from;
      var clientsInChannel = db.getClientsOnSameIrcChannel(client, ircChannel);
      l.debug(clientsInChannel.length);
      var nickBelongsToSlackUser = _.find(clientsInChannel, function(ch) {
        return ch.currentNick === options.from;
      });
      if (nickBelongsToSlackUser) {
        l.debug('Not sending to slack because it came from slack nick: %s', options.from);
        return;
      }
      if (_.some(clientsInChannel, { desiredNick: username })) {
        username = options.from + ' (irc)';
      }
      clientsInChannel.forEach(function(c) {
        var re = new RegExp(c.currentNick, 'gi');
        options.message = options.message.replace(re, '@' + c.desiredNick);
      });
      var slackChannel = db.getSlackChannel(client, ircChannel);
      if (!slackChannel) {
        l.debug('Not sending because we couldn\'t find slack channel %s for "%s"'
          , slackChannel, options.from);
        return;
      }
      slack.postMessage({channel: slackChannel, username: username, text: options.message})
      .fail(function(err) {
        l.error('Failed to send message to Slack: %j', err.toString(), {});
        throw err;
      })
      .done();
    }
  };

  return SlackDispatcher;

}());

module.exports = SlackDispatcher;
