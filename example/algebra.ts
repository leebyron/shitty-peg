'use strict';

// tsc -m commonjs algebra.ts && node algebra.js

/**
 * An algebra parser is a good example of indirect-left-recursion. A weak-point
 * in defining PEG grammars.
 *
 * http://en.wikipedia.org/wiki/Parsing_expression_grammar#Indirect_left_recursion
 */

import Parser = require('../dist/Parser');


// Parse the calculated result

function calcMath(c: Parser.Parse): any {
  return c.pushWhitespaceInsignificant().one(calcAdd);
}

function calcAdd(c: Parser.Parse): any {
  return c.oneOf(
    c => c.one(calcMul) + c.expect('+').one(calcAdd),
    c => c.one(calcMul) - c.expect('-').one(calcAdd),
    calcMul
  );
}

function calcMul(c: Parser.Parse): any {
  return c.oneOf(
    c => c.one(calcExp) * c.expect('*').one(calcMul),
    c => c.one(calcExp) / c.expect('/').one(calcMul),
    calcExp
  );
}

function calcExp(c: Parser.Parse): any {
  return c.oneOf(
    c => Math.pow(c.one(calcParen), c.expect('^').one(calcExp)),
    calcParen
  );
}

// Javascript number
var NUM_RX = /^[+-]?\d+(?:\.\d+)?/;
(<any>NUM_RX).name = 'Number';

function calcParen(c: Parser.Parse): any {
  return c.oneOf(
    c => c.one(NUM_RX, parseInt),
    c => {
      c.expect('(');
      var m = c.one(calcMath);
      c.expect(')');
      return m;
    },
    c => -c.expect('-').one(calcParen)
  );
}


// Similar parse, but returns the AST

function astMath(c: Parser.Parse): any {
  return c.pushWhitespaceInsignificant().one(astAdd);
}

function astAdd(c: Parser.Parse): any {
  return c.oneOf(
    c => ({l:c.one(astMul), t: '+', r:c.expect('+').one(astAdd)}),
    c => ({l:c.one(astMul), t: '-', r:c.expect('-').one(astAdd)}),
    astMul
  );
}

function astMul(c: Parser.Parse): any {
  return c.oneOf(
    c => ({l:c.one(astExp), t: '*', r:c.expect('*').one(astMul)}),
    c => ({l:c.one(astExp), t: '/', r:c.expect('/').one(astMul)}),
    astExp
  );
}

function astExp(c: Parser.Parse): any {
  return c.oneOf(
    c => ({l:c.one(astParen), t: '^', r:c.expect('^').one(astExp)}),
    astParen
  );
}

function astParen(c: Parser.Parse): any {
  return c.oneOf(
    NUM_RX,
    c => {
      c.expect('(');
      var m = c.one(astMath);
      c.expect(')');
      return m;
    },
    c => ({neg:c.expect('-').one(astParen)})
  );
}


// Try

var mathStr = '3 + 4 * 12 / 3 + 5 ^ -(3 + 2) * -5 - 1';
var mathSrc = new Parser.Source(mathStr);

console.log(mathStr);

// Parse and print the calculated result of this expression.
console.log(
  Parser.parse(mathSrc, calcMath)
);

// Parse and print an AST of the expression.
console.log(JSON.stringify(
  Parser.parse(mathSrc, astMath),
  null,
  '  '
));
