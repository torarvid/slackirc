var _ = require('./toolbelt');
var q = require('q');

var parser = {
  parseIrcMessage: function(data) {
    var required = [
      'token',
      'team_id',
      'team_domain',
      'channel_id',
      'channel_name',
      'timestamp',
      'user_id',
      'user_name',
      'text' ];
    if (!_.hasAll(data, required))
      return q.reject('Must supply all required properties: ', required);
    var validValues = _.filter(required, function(key) { return _.isString(data[key]); });
    if (validValues.length < required.length)
      return q.reject('Must have valid values for required properties: ', required);
    return q.resolve(data);
  }
};

module.exports = parser;
