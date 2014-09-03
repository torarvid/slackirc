function HttpError(message, statusCode) {
  this.name = 'HttpError';
  this.message = message || 'HTTP Error';
  this.statusCode = statusCode;
}

HttpError.prototype = new Error();

HttpError.prototype.constructor = HttpError;

HttpError.prototype.toString = function() {
  if (this.statusCode) {
    var msg = 'StatusCode: ' + this.statusCode + '\n';
    return msg + Error.prototype.toString.call(this);
  }
  return Error.prototype.toString.call(this);
};

var error = (function() {
  'use strict';

  var error = {
    httpError: function(statusCode, message) {
      return new HttpError(message, statusCode);
    },

    throwHttpError: function(statusCode, message) {
      throw this.httpError(statusCode, message);
    }
  };

  return error;

}());

module.exports = error;
