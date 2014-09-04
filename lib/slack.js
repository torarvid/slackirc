var _ = require('./toolbelt');
var config = require('config');
var q = require('q');
var request = require('needle');
var l = require('./log')('Slack');

var Slack = (function() {
  'use strict';

  var token = config.slack.apiToken;
  var domain = config.slack.domain;

  var Slack = {
    postMessage: function(options) {
      if (!_.hasAll(options, 'channel', 'text', 'username'))
        return q.reject('Need to provide channel, text and username.');

      return httpSlackPost('chat.postMessage', options);
    }
  };

  var defaultPostData = {
    token: config.slack.apiToken,
    parse: 'full',
    link_names: 1
  };

  var httpSlackPost = function(apiMethod, data) {
    if (!_.isString(apiMethod))
      return q.reject('Must specify api method to post to');
    var deferred = q.defer();
    var url = 'https://slack.com/api/' + apiMethod;
    data = _.defaults(data, defaultPostData);
    l.verbose('POSTing to Slack url:%s, data:%j', url, data, {});
    request.post(url, data, function(error, response, body){
      if (error)
        deferred.reject(error);
      else
        deferred.resolve(response);
    });
    return deferred.promise;
  };

  return Slack;

}());

module.exports = Slack;
