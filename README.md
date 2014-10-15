A pretty shitty PEG parser written in TypeScript.

http://en.wikipedia.org/wiki/Parsing_expression_grammar

---

In Shitty PEG, there is no DSL for defining grammars. It's Just JavaScript™.

Because of this, you can write parsers which can be type-checked by TypeScript,
or written in CoffeeScript or Purescript without any special plugins.

### More shitty features:

 * Support for common white-space and indentation significant grammars.
   Shitty PEG is white-space significant by default.

 * Stash and retrieve arbitrary data in context of the parsing "stack".

 * Easily define delimited lists.


### Pretty shitty drawbacks

 * Synchronous execution. No streams right now.

 * Not particularly fast.


# Getting started

```
npm install shitty-peg
```

```
var peg = require('shitty-peg');
peg.parse(peg.source('abc'), myParser);

function myParser(p) {
  return p.many(/^[a-z]/);
}
```
