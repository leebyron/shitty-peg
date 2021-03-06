'use strict';

// tsc -m commonjs yaml.ts && node yaml.js

/**
 * YAML has a lot of features, this is a simplified version for
 * demonstration purposes.
 */

import Parser = require('../dist/Parser');


// Parse and return JS object or value

function yaml(c: Parser.Parse): any {
  return c.pushWhitespaceInsignificantSingleLine().one(value);
}

function value(c: Parser.Parse): any {
  return c.oneOf(
    array,
    object,
    number,
    string
  );
}

function object(c: Parser.Parse): Object {
  c.indent();
  var obj = {};
  c.many(c => {
    var key = c.one(/^[^\n:]+/);
    c.skip(':');
    var val = c.one(value);
    obj[key] = val;
  }, c => c.newline());
  c.dedent();
  return obj;
}

function array(c: Parser.Parse): Object {
  var arr = c.indent().many(c => c.skip('-').one(value), c => c.newline());
  c.dedent();
  return arr;
}

var NUMBER = Parser.token(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'Number');

function number(c: Parser.Parse): any {
  return parseFloat(c.one(NUMBER));
}

function string(c: Parser.Parse): any {
  return c.one(/^[^\n]+/);
}



// Try

var yamlStr =
  'american:\n'+
  '  - Boston Red Sox\n'+
  '  - Detroit Tigers\n'+
  '  - New York Yankees\n'+
  'national:\n'+
  '  - New York Mets\n'+
  '  - Chicago Cubs\n'+
  '  - Atlanta Braves\n'+
  'players:\n'+
  '  -\n'+
  '    name: Mark McGwire\n'+
  '    hr:   65\n'+
  '    avg:  0.278\n'+
  '  -\n'+
  '    name: Sammy Sosa\n'+
  '    hr:   63\n'+
  '    avg:  0.288';

console.log(yamlStr);

console.log(
  Parser.parse(new Parser.Source(yamlStr), yaml)
);
