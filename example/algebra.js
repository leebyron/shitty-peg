'use strict';
// tsc -m commonjs algebra.ts && node algebra.js
/**
* An algebra parser is a good example of indirect-left-recursion. A weak-point
* in defining PEG grammars.
*
* http://en.wikipedia.org/wiki/Parsing_expression_grammar#Indirect_left_recursion
*/
var Parser = require('../dist/Parser');

// Javascript number
var NUM_RX = /[+-]?\d+(?:\.\d+)?/g;
NUM_RX.name = 'Number';

var mathStr = '3 + 4 * 12 / 3 + 5 ^ -(3 + 2) * -5 - 1';
var mathSrc = new Parser.Source(mathStr);

console.log(mathStr);

// Parse and print the calculated result of this expression.
console.log(Parser.parse(mathSrc, calcMath));

// Parse and print an AST of the expression.
console.log(JSON.stringify(Parser.parse(mathSrc, astMath), null, '  '));

// Parse the calculated result
function calcMath(c) {
    return c.pushWhitespaceInsignificant().one(calcAdd);
}

function calcAdd(c) {
    return c.oneOf(function (c) {
        return c.one(calcMul) + c.expect('+').one(calcAdd);
    }, function (c) {
        return c.one(calcMul) - c.expect('-').one(calcAdd);
    }, calcMul);
}

function calcMul(c) {
    return c.oneOf(function (c) {
        return c.one(calcExp) * c.expect('*').one(calcMul);
    }, function (c) {
        return c.one(calcExp) / c.expect('/').one(calcMul);
    }, calcExp);
}

function calcExp(c) {
    return c.oneOf(function (c) {
        return Math.pow(c.one(calcParen), c.expect('^').one(calcExp));
    }, calcParen);
}

function calcParen(c) {
    return c.oneOf(function (c) {
        return c.one(NUM_RX, function (data) {
            return parseInt(data[0]);
        });
    }, function (c) {
        c.expect('(');
        var m = c.one(calcMath);
        c.expect(')');
        return m;
    }, function (c) {
        return -c.expect('-').one(calcParen);
    });
}

// Similar parse, but returns the AST
function astMath(c) {
    return c.pushWhitespaceInsignificant().one(astAdd);
}

function astAdd(c) {
    return c.oneOf(function (c) {
        return ({ l: c.one(astMul), t: '+', r: c.expect('+').one(astAdd) });
    }, function (c) {
        return ({ l: c.one(astMul), t: '-', r: c.expect('-').one(astAdd) });
    }, astMul);
}

function astMul(c) {
    return c.oneOf(function (c) {
        return ({ l: c.one(astExp), t: '*', r: c.expect('*').one(astMul) });
    }, function (c) {
        return ({ l: c.one(astExp), t: '/', r: c.expect('/').one(astMul) });
    }, astExp);
}

function astExp(c) {
    return c.oneOf(function (c) {
        return ({ l: c.one(astParen), t: '^', r: c.expect('^').one(astExp) });
    }, astParen);
}

function astParen(c) {
    return c.oneOf(NUM_RX, function (c) {
        c.expect('(');
        var m = c.one(astMath);
        c.expect(')');
        return m;
    }, function (c) {
        return ({ neg: c.expect('-').one(astParen) });
    });
}
