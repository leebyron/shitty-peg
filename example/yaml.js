'use strict';
// tsc -m commonjs yaml.ts && node yaml.js
/**
* YAML has a lot of features, this is a simplified version for
* demonstration purposes.
*/
var Parser = require('../dist/Parser');

// Parse and return JS object or value
function yaml(c) {
    return c.pushWhitespaceInsignificantSingleLine().one(value);
}

function value(c) {
    return c.oneOf(array, object, number, string);
}

function object(c) {
    c.indent();
    var obj = {};
    c.many(function (c) {
        var key = c.one(/^[^\n:]+/);
        c.skip(':');
        var val = c.one(value);
        obj[key] = val;
    }, function (c) {
        return c.newline();
    });
    c.dedent();
    return obj;
}

function array(c) {
    var arr = c.indent().many(function (c) {
        return c.skip('-').one(value);
    }, function (c) {
        return c.newline();
    });
    c.dedent();
    return arr;
}

var NUMBER = Parser.token(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'Number');

function number(c) {
    return parseFloat(c.one(NUMBER));
}

function string(c) {
    return c.one(/^[^\n]+/);
}

// Try
var yamlStr = 'american:\n' + '  - Boston Red Sox\n' + '  - Detroit Tigers\n' + '  - New York Yankees\n' + 'national:\n' + '  - New York Mets\n' + '  - Chicago Cubs\n' + '  - Atlanta Braves\n' + 'players:\n' + '  -\n' + '    name: Mark McGwire\n' + '    hr:   65\n' + '    avg:  0.278\n' + '  -\n' + '    name: Sammy Sosa\n' + '    hr:   63\n' + '    avg:  0.288';

console.log(yamlStr);

console.log(Parser.parse(new Parser.Source(yamlStr), yaml));
