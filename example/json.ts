'use strict';

// tsc -m commonjs json.ts && node json.js

/**
 * JSON's grammar translates very well to a PEG parser.
 * // http://json.org/
 */

import Parser = require('../dist/Parser');


var jsonStr = '{"string":"stri\\nng\ufb95","integer":1234,"fp":123.345,"exp":1.45e-32,"object":{"deeper":"value"},"array":["one",2],"trueVal":true,"falseVal":false,"nullVal":null}';

console.log(jsonStr);

var jsonVal = Parser.parse(new Parser.Source(jsonStr), json);

console.log(jsonVal);

console.log(JSON.parse(jsonStr));


// Parse and return JS object or value

function json(c: Parser.Parse): any {
  return c.pushWhitespaceInsignificant().one(value);
}

function value(c: Parser.Parse): any {
  return c.oneOf(
    string,
    number,
    object,
    array,
    c => c.one('true', true),
    c => c.one('false', false),
    c => c.one('null', null)
  );
}

function string(c: Parser.Parse): any {
  c.expect('"').pushWhitespaceAllSignificant();
  var chars = c.many(c => c.oneOf(
    /[^"\\\x7F\x00-\x1F]/g,
    c => c.expect('\\').oneOf(
      '"',
      '\\',
      '/',
      c => c.one('b', '\b'),
      c => c.one('f', '\f'),
      c => c.one('n', '\n'),
      c => c.one('r', '\r'),
      c => c.one('t', '\t'),
      c => c.expect('u').one(/[a-fA-F0-9]{4}/, data => String.fromCharCode(data[0]))
    )
  ));
  c.expect('"').popWhitespaceSignificance();
  return chars.join('');
}

function number(c: Parser.Parse): any {
  return c.one(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g, data => parseFloat(data[0]));
}

function object(c: Parser.Parse): any {
  c.expect('{');
  var obj = {};
  c.any(c => {
    var key = c.one(string);
    c.expect(':');
    var val = c.one(value);
    obj[key] = val;
  }, ',');
  c.expect('}');
  return obj;
}

function array(c: Parser.Parse): any {
  c.expect('[');
  var arr = [];
  c.any(c => { arr.push(c.one(value)); }, ',');
  c.expect(']');
  return arr;
}

