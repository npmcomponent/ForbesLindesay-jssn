function type(val){
  var toString = Object.prototype.toString;
  switch (toString.call(val)) {
    case '[object Function]': return 'function';
    case '[object Date]': return 'date';
    case '[object RegExp]': return 'regexp';
    case '[object Arguments]': return 'arguments';
    case '[object Array]': return 'array';
  }

  if (typeof val == 'object' && val && typeof val.length == 'number') {
    try {
      if (typeof val.callee == 'function') return 'arguments';
    } catch (ex) {
      if (ex instanceof TypeError) {
        return 'arguments';
      }
    }
  }

  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (val === Object(val)) return 'object';

  return typeof val;
}

var keys = Object.keys || require('component-object').keys;
function createObject(obj) {
  if (Object.create) return Object.create(obj);
  function S() {}
  S.prototype = obj;
  S.prototype.constructor = obj.constructor;
  return new S();
}

var json = typeof JSON === 'object' ? JSON : require('ForbesLindesay-json');

function map(array, fn) {
  if (array.map) return array.map(fn);
  var res = [];
  for (var i = 0; i < array.length; i++) {
    res.push(fn(array[i], i, array));
  }
  return res;
}
function filter(array, fn) {
  if (array.filter) return array.filter(fn);
  var res = [];
  for (var i = 0; i < array.length; i++) {
    if (fn(array[i], i, array)) res.push(array[i]);
  }
  return res;
}
function trim(str) {
  if (typeof str.trim === 'function') return str.trim();
  return str.replace(/^ +/, '').replace(/ +$/, '');
}

exports.stringify = stringify;
exports.parse = parse;

function stringify(obj) {
  var circular = [{
    encoded: null,
    original: obj
  }];
  circular[0].encoded = encode(obj, circular, true);
  return json.stringify(map(circular, function (o) {
    return o.encoded;
  }));
}

function encode(obj, circular, root) {
  switch (type(obj)) {
    case 'string':
      return 's' + obj;
    case 'date':
      return 'd' + obj.getTime();
    case 'regexp':
      return 'r/' + obj.source + '/' + (obj.global?'g':'') + (obj.ignoreCase?'i':'') + (obj.multiline?'m':'');
    case 'function':
      return encodeFunction(obj, circular);
    case 'arguments':
    case 'array':
    case 'object':
      return encodeCircular(obj, circular, root);
    default:
      return obj;
  }
}
function encodeCircular(obj, circular, root) {
  if (!root) {
    for (var i = 0; i < circular.length; i++) {
      if (circular[i].original === obj) {
        return 'c' + i;
      }
    }
  }
  var encoded = type(obj) === 'object' ? {} : [];
  var ref = 'c' + circular.length;
  if (!root) {
    circular.push({
      encoded: encoded,
      original: obj
    });
  }

  if (type(obj) === 'object') {
    encodeObject(obj, encoded, circular);
  } else {
    encodeArray(obj, encoded, circular);
  }

  return root ? encoded : ref;
}

function encodeArray(from, to, circular) {
  for (var i = 0; i < from.length; i++) {
    to.push(encode(from[i], circular));
  }
}
function encodeObject(from, to, circular) {
  if (from.constructor != Object) {
    var parsedConstructor = /^function([^\(]+)\(/.exec(from.constructor.toString());
    if (parsedConstructor)
      to['_jssn_proto'] = trim(parsedConstructor[1]);
    else
      to['_jssn_proto'] = from.constructor.toString();
  }
  var k = keys(from);
  for (var i = 0; i < k.length; i++) {
    (function (key) {
      to[key] = encode(from[key], circular);
    }(k[i]));
  }
}
function encodeFunction(obj, circular) {
  var str = obj.toString();
  for (var i = 0; i < circular.length; i++) {
    if (circular[i].original === str) {
      return 'f' + i;
    }
  }
  circular.push({encoded: str, original: str});
  return 'f' + (circular.length - 1);
}

function parse(str, cons) {
  var constructors = {};
  if (typeof global != 'undefined') {
    for (var key in global) {
      constructors[key] = global[key];
    }
  }
  if (cons) {
    for (var key in cons) {
      constructors[key] = cons[key];
    }
  }
  var source = map(json.parse(str), function (o, i) {
    if (type(o) === 'array') {
      return {
        encoded: o,
        decoded: false,
        original: []
      };
    }
    if (type(o) === 'object') {
      var original = {};

      if (o['_jssn_proto'] && constructors[o['_jssn_proto']]) {
        original = createObject(constructors[o['_jssn_proto']].prototype);
      }
      return {
        encoded: o,
        decoded: false,
        original: original
      };
    }
    if (type(o) === 'string' && i != 0) {
      var parsed = /^function[^\(]*\(([^\)]*)\) ?\{((?:\n|\r|.)*)\}$/.exec(o);
      if (!parsed) console.log(json.stringify(o));
      var args = filter(map(parsed[1].split(','), trim), function (a) { return a; });
      args.push(parsed[2]);
      return Function.apply(null, args);
    } else {
      return {encoded: o, decoded: false, original: null};
    }
  });
  return decode(source[0].encoded, source, source[0]);
}

function decode(obj, circular, ref) {
  if (ref) ref.decoded = true;
  if (type(obj) === 'string') {
    switch (obj.substring(0, 1)) {
      case 's': return obj.substring(1);
      case 'd': return new Date(+obj.substring(1));
      case 'r': return new RegExp(obj.split('/')[1], obj.split('/')[2]);
      case 'f': return circular[obj.substring(1)];
      case 'c':
        var ref = circular[obj.substring(1)];
        if (!ref.decoded) {
          decode(ref.encoded, circular, ref);
        }
        return ref.original;

    }
  } else if (type(obj) === 'object') {
    return decodeObject(obj, ref.original, circular);
  } else if (type(obj) === 'array') {
    return decodeArray(obj, ref.original, circular);
  } else {
    return obj;
  }
}
function decodeArray(from, to, circular) {
  for (var i = 0; i < from.length; i++) {
    to.push(decode(from[i], circular));
  }
  return to;
}
function decodeObject(from, to, circular) {
  var k = keys(from);
  for (var i = 0; i < k.length; i++) {
    (function (key) {
      if (key === '_jssn_proto') return;
      to[key] = decode(from[key], circular);
    }(k[i]));
  }
  return to;
}