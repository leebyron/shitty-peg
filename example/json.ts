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
    c => c.skip('true') && true,
    c => c.skip('false') && false,
    c => c.skip('null') && null
  );
}

function string(c: Parser.Parse): String {
  c.skip('"').pushWhitespaceAllSignificant();
  var chars = c.many(c => c.oneOf(
    /^[^"\\\x7F\x00-\x1F]+/,
    c => c.skip('\\').oneOf(
      '"',
      '\\',
      '/',
      c => c.skip('b') && '\b',
      c => c.skip('f') && '\f',
      c => c.skip('n') && '\n',
      c => c.skip('r') && '\r',
      c => c.skip('t') && '\t',
      c => String.fromCharCode(parseInt(c.skip('u').one(/^[a-fA-F0-9]{4}/), 16))
    )
  ));
  c.skip('"').popWhitespaceSignificance();
  return chars.join('');
}

var NUMBER = Parser.token(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'NUMBER');

function number(c: Parser.Parse): Number {
  return parseFloat(c.one(NUMBER));
}

function object(c: Parser.Parse): Object {
  c.skip('{');
  var obj = {};
  c.any(c => {
    var key = c.one(string);
    c.skip(':');
    var val = c.one(value);
    obj[key] = val;
  }, ',');
  c.skip('}');
  return obj;
}

function array(c: Parser.Parse): Array<any> {
  c.skip('[');
  var arr = [];
  c.any(c => { arr.push(c.one(value)); }, ',');
  c.skip(']');
  return arr;
}


// Try

var jsonStr = '{  "string":  "stri\\nng\\ufb95",  "integer": 1234, "fp" : \n'+
  '123.345,  "exp":1.45e-32, "object": { "deeper":"value"}, "array":   \n'+
  ' ["one", 2], "  trueVal  ":true, "falseVal":false,  "nullVal":null  }';

console.log(jsonStr);

// Shitty is about 50-100x slower than Native JSON.parse in node v0.10
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
