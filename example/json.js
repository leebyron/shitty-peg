'use strict';
// tsc -m commonjs json.ts && node json.js
/**
* JSON's grammar translates very well to a PEG parser.
* // http://json.org/
*/
var Parser = require('../dist/Parser');

// Parse and return JS object or value
function json(c) {
    return c.pushWhitespaceInsignificant().one(value);
}

function value(c) {
    return c.oneOf(string, number, object, array, function (c) {
        return c.skip('true') && true;
    }, function (c) {
        return c.skip('false') && false;
    }, function (c) {
        return c.skip('null') && null;
    });
}

function string(c) {
    c.skip('"').pushWhitespaceAllSignificant();
    var chars = c.many(function (c) {
        return c.oneOf(/^[^"\\\x7F\x00-\x1F]+/, function (c) {
            return c.skip('\\').oneOf('"', '\\', '/', function (c) {
                return c.skip('b') && '\b';
            }, function (c) {
                return c.skip('f') && '\f';
            }, function (c) {
                return c.skip('n') && '\n';
            }, function (c) {
                return c.skip('r') && '\r';
            }, function (c) {
                return c.skip('t') && '\t';
            }, function (c) {
                return String.fromCharCode(parseInt(c.skip('u').one(/^[a-fA-F0-9]{4}/), 16));
            });
        });
    });
    c.skip('"').popWhitespaceSignificance();
    return chars.join('');
}

var NUMBER = Parser.token(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'NUMBER');

function number(c) {
    return parseFloat(c.one(NUMBER));
}

function object(c) {
    c.skip('{');
    var obj = {};
    c.any(function (c) {
        var key = c.one(string);
        c.skip(':');
        var val = c.one(value);
        obj[key] = val;
    }, ',');
    c.skip('}');
    return obj;
}

function array(c) {
    var arr = c.skip('[').any(value, ',');
    c.skip(']');
    return arr;
}

// Try
var jsonStr = '{  "string":  "stri\\nng\\ufb95",  "integer": 1234, "fp" : \n' + '123.345,  "exp":1.45e-32, "object": { "deeper":"value"}, "array":   \n' + ' ["one", 2], "  trueVal  ":true, "falseVal":false,  "nullVal":null  }';

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
