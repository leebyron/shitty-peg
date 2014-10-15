'use strict';

// tsc -m commonjs json.ts && node json.js

/**
 * JSON's grammar translates very well to a PEG parser.
 * // http://json.org/
 */

import Parser = require('../dist/Parser');


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

function string(c: Parser.Parse): String {
  c.expect('"').pushWhitespaceAllSignificant();
  var chars = c.many(c => c.oneOf(
    /^[^"\\\x7F\x00-\x1F]+/,
    c => c.expect('\\').oneOf(
      '"',
      '\\',
      '/',
      c => c.one('b', '\b'),
      c => c.one('f', '\f'),
      c => c.one('n', '\n'),
      c => c.one('r', '\r'),
      c => c.one('t', '\t'),
      c => c.expect('u').one(/^[a-fA-F0-9]{4}/, String.fromCharCode)
    )
  ));
  c.expect('"').popWhitespaceSignificance();
  return chars.join('');
}

var NUM_RX = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
(<any>NUM_RX).name = 'Number';

function number(c: Parser.Parse): Number {
  return c.one(NUM_RX, parseFloat);
}

function object(c: Parser.Parse): Object {
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

function array(c: Parser.Parse): Array<any> {
  c.expect('[');
  var arr = [];
  c.any(c => { arr.push(c.one(value)); }, ',');
  c.expect(']');
  return arr;
}


// Try

var jsonStr = '{"string":"stri\\nng\ufb95","integer":1234,"fp":123.345,"exp":1.45e-32,"object":{"deeper":"value"},"array":["one",2],"trueVal":true,"falseVal":false,"nullVal":null}';

console.log(jsonStr);

// Shitty is about 42x slower than Native JSON.parse in node v0.10
var shitty;
console.time('shitty-peg');
for (var x = 0; x < 10000; x++) {
  shitty = Parser.parse(new Parser.Source(jsonStr), json);
}
console.timeEnd('shitty-peg');
console.log(shitty);

var jsonNative;
console.time('jsonNative');
for (var x = 0; x < 10000; x++) {
  jsonNative = JSON.parse(jsonStr);
}
console.timeEnd('jsonNative');
console.log(jsonNative);
