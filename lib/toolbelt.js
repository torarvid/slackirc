var impl = require('lodash');

var hasAll = function hasAll (obj) {
  var args = Array.prototype.slice.call(arguments, 1);

  for (var i = 0, len = args.length; i < len; i++)
    if (!impl.has(obj, args[i]))
      return false;
  return true;
};

impl.mixin({'hasAll': hasAll}, {chain: false});

module.exports = impl;
