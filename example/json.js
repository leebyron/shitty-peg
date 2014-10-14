'use strict';
// tsc -m commonjs json.ts && node json.js
/**
* JSON's grammar translates very well to a PEG parser.
* // http://json.org/
*/
var Parser = require('../dist/Parser');

var jsonStr = '{"string":"stri\\nng\ufb95","integer":1234,"fp":123.345,"exp":1.45e-32,"object":{"deeper":"value"},"array":["one",2],"trueVal":true,"falseVal":false,"nullVal":null}';

console.log(jsonStr);

var jsonVal = Parser.parse(new Parser.Source(jsonStr), json);

console.log(jsonVal);

console.log(JSON.parse(jsonStr));

// Parse and return JS object or value
function json(c) {
    return c.pushWhitespaceInsignificant().one(value);
}

function value(c) {
    return c.oneOf(string, number, object, array, function (c) {
        return c.one('true', true);
    }, function (c) {
        return c.one('false', false);
    }, function (c) {
        return c.one('null', null);
    });
}

function string(c) {
    c.expect('"').pushWhitespaceAllSignificant();
    var chars = c.many(function (c) {
        return c.oneOf(/[^"\\\x7F\x00-\x1F]/g, function (c) {
            return c.expect('\\').oneOf('"', '\\', '/', function (c) {
                return c.one('b', '\b');
            }, function (c) {
                return c.one('f', '\f');
            }, function (c) {
                return c.one('n', '\n');
            }, function (c) {
                return c.one('r', '\r');
            }, function (c) {
                return c.one('t', '\t');
            }, function (c) {
                return c.expect('u').one(/[a-fA-F0-9]{4}/, function (data) {
                    return String.fromCharCode(data[0]);
                });
            });
        });
    });
    c.expect('"').popWhitespaceSignificance();
    return chars.join('');
}

function number(c) {
    return c.one(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g, function (data) {
        return parseFloat(data[0]);
    });
}

function object(c) {
    c.expect('{');
    var obj = {};
    c.any(function (c) {
        var key = c.one(string);
        c.expect(':');
        var val = c.one(value);
        obj[key] = val;
    }, ',');
    c.expect('}');
    return obj;
}

function array(c) {
    c.expect('[');
    var arr = [];
    c.any(function (c) {
        arr.push(c.one(value));
    }, ',');
    c.expect(']');
    return arr;
}
