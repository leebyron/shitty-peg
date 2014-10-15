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
    c => c.one(calcMul) + c.skip('+').one(calcAdd),
    c => c.one(calcMul) - c.skip('-').one(calcAdd),
    calcMul
  );
}

function calcMul(c: Parser.Parse): any {
  return c.oneOf(
    c => c.one(calcExp) * c.skip('*').one(calcMul),
    c => c.one(calcExp) / c.skip('/').one(calcMul),
    calcExp
  );
}

function calcExp(c: Parser.Parse): any {
  return c.oneOf(
    c => Math.pow(c.one(calcParen), c.skip('^').one(calcExp)),
    calcParen
  );
}

// Javascript number
var NUM_RX = /^[+-]?\d+(?:\.\d+)?/;
(<any>NUM_RX).name = 'Number';

function calcParen(c: Parser.Parse): any {
  return c.oneOf(
    c => parseInt(c.one(NUM_RX)),
    c => {
      c.skip('(');
      var m = c.one(calcMath);
      c.skip(')');
      return m;
    },
    c => -c.skip('-').one(calcParen)
  );
}


// Similar parse, but returns the AST

function astMath(c: Parser.Parse): any {
  return c.pushWhitespaceInsignificant().one(astAdd);
}

function astAdd(c: Parser.Parse): any {
  return c.oneOf(
    c => [c.one(astMul), c.oneOf('+','-'), c.one(astAdd)],
    astMul
  );
}

function astMul(c: Parser.Parse): any {
  return c.oneOf(
    c => [c.one(astExp), c.oneOf('*','/'), c.one(astMul)],
    astExp
  );
}

function astExp(c: Parser.Parse): any {
  return c.oneOf(
    c => [c.one(astParen), c.one('^'), c.one(astExp)],
    astParen
  );
}

function astParen(c: Parser.Parse): any {
  return c.oneOf(
    c => parseInt(c.one(NUM_RX)),
    c => {
      var m = c.skip('(').one(astMath);
      c.skip(')');
      return m;
    },
    c => [c.one('-'), c.one(astParen)]
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
