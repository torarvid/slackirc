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
        l.debug('Not sending to slack because it came from client "%s" and not "%s"'
          , client.desiredNick, senderClient.desiredNick);
        return;
      }
      var username = options.from;
      var clientsInChannel = db.getClientsOnSameIrcChannel(client, ircChannel);
      var nickBelongsToSlackUser = _.find(clientsInChannel, function(c) {
        l.verbose('Nick cmp "%s" === "%s"', c.currentNick, username);
        return c.currentNick === username;
      });
      if (nickBelongsToSlackUser) {
        l.debug('Not sending to slack because it came from slack nick: %s', username);
        return;
      }
      if (_.some(db.getUsers(), { name: username })) {
        username += ' (irc)';
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
