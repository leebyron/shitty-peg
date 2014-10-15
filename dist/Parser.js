'use strict';
var invariant = require('./invariant');
var Stack = require('./Stack');

/**
* Primary entry point, Parser.parse() takes a string and parse function and
* runs the parser.
*
*     Parser.parse(Parser.Source('abc'), myParseFn);
*
*/
function parse(source, parser, callback) {
    return new Parse(source).run(parser, callback);
}
exports.parse = parse;


function token(strOrRx, name) {
    return strOrRx instanceof RegExp ? new RegExpToken(strOrRx, name) : new StringToken(strOrRx, name);
}
exports.token = token;

/**
* Identify sources.
*/
var Source = (function () {
    function Source(body, name) {
        this.body = body;
        this.name = name;
    }
    return Source;
})();
exports.Source = Source;

/**
* A syntax error generated by a Parse.
* Provided as an argument in the callback given to Parse.parse()
* Includes information about the line and column where the error was
* encountered, along with information about what was expected.
*/
var ParseError = (function () {
    function ParseError() {
        this.expected = [];
    }
    ParseError.prototype.toString = function () {
        var unexpected = this.location.offset === this.location.source.body.length ? 'End of source' : tokenDesc(this.location.source.body[this.location.offset]);
        return 'Syntax error: unexpected ' + unexpected + '. ' + 'Expected ' + this.expected.join(' or ') + ' at ' + this.location;
    };
    return ParseError;
})();
exports.ParseError = ParseError;

/**
* Provided as part of a ParseError. Use to provide clear information about
* the parse error.
*/
var Location = (function () {
    function Location(source, offset) {
        this.source = source;
        this.offset = offset;
    }
    Location.prototype.toString = function () {
        var lc = this.lineColumn();
        return [
            this.source.name, lc.line, lc.column
        ].filter(function (x) {
            return !!x;
        }).join(':');
    };

    Location.prototype.line = function () {
        return this.lineColumn().line;
    };

    Location.prototype.column = function () {
        return this.lineColumn().column;
    };

    Location.prototype.lineColumn = function () {
        var nl = /\n/g;
        var line = 0;
        var column;
        var data = { index: -1 };
        do {
            line++;
            column = this.offset - data.index;
            data = nl.exec(this.source.body);
        } while(data && data.index < this.offset);
        return { line: line, column: column };
    };
    return Location;
})();
exports.Location = Location;

/**
* A parsing operation. Chain methods to define and run a parse:
*/
var Parse = (function () {
    // # Special Use
    /**
    * Create a new parse operation from a given source.
    *
    * Usually just call Parser.parse() directly
    */
    function Parse(source) {
        this.source = source;
        this.offset = 0;
        this._context = new Stack();
        this._depth = new Stack(0);
        this._sigWhitespace = new Stack(3 /* NONE */);
        this._syntaxError = new ParseError();
        this._syntaxError.location = new Location(source, 0);
    }
    Parse.prototype.isNext = function (t) {
        this._whitespace();
        return !!tokenize(this, t);
    };

    Parse.prototype.skip = function (token) {
        this.one(token);
        return this;
    };

    Parse.prototype.one = function (t) {
        if (typeof t === 'function') {
            return t(this);
        }
        this._whitespace();
        var result = tokenize(this, t);
        if (!result) {
            this.expected(tokenDesc(t));
        }
        this.offset += result.length;
        return result;
    };

    /**
    * Runs each parser in order, stopping once one has completed without
    * encountering a ParseError. If all parsers fail, the one which parsed
    * the furthest will present it's ParseError.
    */
    //oneOf(...tokenOrParsers: Array<Token|string|RegExp|(c: Parse) => any>): any;
    Parse.prototype.oneOf = function () {
        var tokenOrParsers = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            tokenOrParsers[_i] = arguments[_i + 0];
        }
        for (var ii = 0; ii < arguments.length; ii++) {
            try  {
                var copy = this._copy();
                var result = copy.one(arguments[ii]);
                this._resume(copy);
                return result;
            } catch (error) {
                if (error !== this._syntaxError) {
                    throw error;
                }
            }
        }
        throw this._syntaxError;
    };

    /**
    * Runs the parser as many times as possible, running the delimiterParser
    * between each run. Continues until a parser fails, returns an array of
    * parsed tokens, skipping delimiter.
    */
    //any(
    //  token: Token|string|RegExp
    //  delimiter?: Token|string|RegExp|(c: Parse) => T
    //): string[]
    //any<T>(
    //  token: (c: Parse) => T
    //  delimiter?: Token|string|RegExp|(c: Parse) => T
    //): T[]
    Parse.prototype.any = function (token, delimiter) {
        return this._list(token, delimiter, false);
    };

    /**
    * Like any(), but requires at least one successful parse.
    */
    //many(
    //  token: Token|string|RegExp
    //  delimiter?: Token|string|RegExp|(c: Parse) => T
    //): string[]
    //many<T>(
    //  token: (c: Parse) => T
    //  delimiter?: Token|string|RegExp|(c: Parse) => T
    //): T[]
    Parse.prototype.many = function (token, delimiter) {
        return this._list(token, delimiter, true);
    };

    /**
    * Runs the parser, returns undefined if the parser failed, but does not
    * result in a ParseError.
    */
    Parse.prototype.optional = function (parser) {
        try  {
            var copy = this._copy();
            var result = copy.one(parser);
            this._resume(copy);
            return result;
        } catch (error) {
            if (error !== this._syntaxError) {
                throw error;
            }
        }
    };

    /**
    * If newlines are significant, skips a newline with the same indentation.
    */
    Parse.prototype.newline = function () {
        return this._line(1 /* NEWLINE */);
    };

    /**
    * If newlines are significant, skips a newline with more indentation.
    */
    Parse.prototype.indent = function () {
        if (this.offset === 0) {
            return this;
        }
        return this._line(2 /* INDENT */);
    };

    /**
    * If newlines are significant, skips a newline with less indentation.
    * Note: Does not consume the newline.
    */
    Parse.prototype.dedent = function () {
        if (this.offset === this.source.body.length) {
            return this;
        }
        return this._line(0 /* DEDENT */);
    };

    /**
    * Expect the end of the file, otherwise a syntax error.
    */
    Parse.prototype.end = function () {
        this._whitespace(2 /* MULTI_LINE */);
        if (this.offset !== this.source.body.length) {
            this.expected('End of source');
        }
        return this;
    };

    /**
    * Provide a description and a valid SyntaxError will be returned.
    */
    Parse.prototype.expected = function (tokenDescription) {
        if (this.offset > this._syntaxError.location.offset) {
            this._syntaxError.location.offset = this.offset;
            this._syntaxError.expected.length = 0;
        }
        if (this.offset >= this._syntaxError.location.offset) {
            this._syntaxError.expected.push(tokenDescription);
        }
        throw this._syntaxError;
    };

    // # Metadata
    /**
    * Returns a location descriptor for the current state of the Parse.
    *
    * Useful if your AST should have location information.
    */
    Parse.prototype.location = function () {
        this._whitespace();
        return new Location(this.source, this.offset);
    };

    // # Whitespace significance
    /**
    * By default, the parser treats whitespace as significant.
    * To treat it as insignificant, use one of the pushWhitespace methods below
    * and later call popWhitespaceSignificance() to revert to the previous value.
    */
    Parse.prototype.popWhitespaceSignificance = function () {
        this._sigWhitespace = this._sigWhitespace.pop();
        return this;
    };

    /**
    * In this mode, all whitespace is insignificant, including line breaks.
    */
    Parse.prototype.pushWhitespaceInsignificant = function () {
        this._sigWhitespace = this._sigWhitespace.push(2 /* MULTI_LINE */);
        return this;
    };

    /**
    * In this mode, spaces and tabs are insignificant, but line breaks are not.
    */
    Parse.prototype.pushWhitespaceInsignificantSingleLine = function () {
        this._sigWhitespace = this._sigWhitespace.push(1 /* SINGLE_LINE */);
        return this;
    };

    /**
    * In this mode, all spacing is significant, this is the default.
    */
    Parse.prototype.pushWhitespaceAllSignificant = function () {
        this._sigWhitespace = this._sigWhitespace.push(3 /* NONE */);
        return this;
    };

    // # Context
    /**
    * Arbitrary data provided to be tracked and retrieved while parsing.
    */
    Parse.prototype.context = function () {
        return this._context.value;
    };

    Parse.prototype.setContext = function (context) {
        this._context = this._context.pop().push(context);
        return this;
    };

    Parse.prototype.pushContext = function (context) {
        this._context = this._context.push(context);
        return this;
    };

    Parse.prototype.popContext = function () {
        this._context = this._context.pop();
        return this;
    };

    /**
    * Start a Parse with a given parser.
    */
    Parse.prototype.run = function (parser, callback) {
        this.offset = 0;
        try  {
            var ast = this.one(parser);
            this.end();
            callback && callback(null, ast);
            return ast;
        } catch (error) {
            if (error !== this._syntaxError) {
                throw error;
            }

            // Clean up the error.
            this._syntaxError.expected = unique(this._syntaxError.expected);
            if (callback) {
                callback(this._syntaxError, null);
            } else {
                throw new Error(this._syntaxError.toString());
            }
        }
    };

    Parse.prototype._copy = function () {
        return (new Parse(this.source))._resume(this);
    };

    Parse.prototype._resume = function (c) {
        if (this !== c) {
            this.source = c.source;
            this._context = c._context;
            this.offset = c.offset;
            this._depth = c._depth;
            this._sigWhitespace = c._sigWhitespace;
            this._syntaxError = c._syntaxError;
        }
        return this;
    };

    Parse.prototype._whitespace = function (style) {
        style = style || this._sigWhitespace.value;
        if (style === 3 /* NONE */) {
            return this;
        }
        var sp = tokenizeRx(this, style === 2 /* MULTI_LINE */ ? ALL_WHITESPACE_RX : SINGLE_LINE_WHITESPACE_RX);
        if (sp) {
            this.offset += sp.length;
        }
        return this;
    };

    Parse.prototype._line = function (direction) {
        var style = this._sigWhitespace.value;
        invariant(style !== 2 /* MULTI_LINE */, 'Cannot parse significant lines when white space is insignificant');
        var c = this._whitespace();

        var offset = c.offset;
        var depth;
        if (c.source.body[offset] !== '\n') {
            this.expected(indentationDesc(direction));
        }
        offset++;
        while (true) {
            depth = 0;
            while (true) {
                var next = c.source.body[offset];
                if (next === ' ') {
                    depth++;
                    offset++;
                } else if (next === '\t') {
                    depth += 2;
                    offset++;
                } else {
                    break;
                }
            }
            if (c.source.body[offset] !== '\n') {
                break;
            }
            offset++;
        }
        if (direction !== 0 /* DEDENT */) {
            c.offset = offset;
        }

        var currentDepth = this._depth.value;
        if (direction === 1 /* NEWLINE */) {
            if (depth !== currentDepth) {
                this.expected(indentationDesc(direction));
            }
            this._resume(c);
        } else if (direction === 2 /* INDENT */) {
            if (depth <= currentDepth) {
                this.expected(indentationDesc(direction));
            }
            this._resume(c);
            this._depth = this._depth.push(depth);
        } else if (direction === 0 /* DEDENT */) {
            var prevDepth = this._depth.pop().value;
            if (depth > prevDepth) {
                this.expected(indentationDesc(direction));
            }
            this._depth = this._depth.pop();
        } else {
            invariant(false, 'Unexpected direction ' + direction);
        }
        return this;
    };

    Parse.prototype._list = function (token, delimiter, requireOne) {
        var c = this;
        var astList = [];
        try  {
            while (true) {
                var nextCtx = c._copy();
                if (delimiter && astList.length > 0) {
                    nextCtx.one(delimiter);
                }
                var ast = nextCtx.one(token);
                c = nextCtx;
                invariant(c != null, 'parser must return a context');
                astList.push(ast);
            }
        } catch (error) {
            if (error !== this._syntaxError) {
                throw error;
            }
            if (requireOne && astList.length == 0) {
                throw error;
            }
        }
        this._resume(c);
        return astList;
    };
    return Parse;
})();
exports.Parse = Parse;

var ALL_WHITESPACE_RX = /^\s+/;
var SINGLE_LINE_WHITESPACE_RX = /^(?:[ \t]|(?:\\\n))+/;

var WhiteSpaceStyle;
(function (WhiteSpaceStyle) {
    WhiteSpaceStyle[WhiteSpaceStyle["SINGLE_LINE"] = 1] = "SINGLE_LINE";
    WhiteSpaceStyle[WhiteSpaceStyle["MULTI_LINE"] = 2] = "MULTI_LINE";
    WhiteSpaceStyle[WhiteSpaceStyle["NONE"] = 3] = "NONE";
})(WhiteSpaceStyle || (WhiteSpaceStyle = {}));

var IndentationDirection;
(function (IndentationDirection) {
    IndentationDirection[IndentationDirection["DEDENT"] = 0] = "DEDENT";
    IndentationDirection[IndentationDirection["NEWLINE"] = 1] = "NEWLINE";
    IndentationDirection[IndentationDirection["INDENT"] = 2] = "INDENT";
})(IndentationDirection || (IndentationDirection = {}));

function indentationDesc(dir) {
    switch (dir) {
        case 0 /* DEDENT */:
            return 'Dedent';
        case 1 /* NEWLINE */:
            return 'Newline';
        case 2 /* INDENT */:
            return 'Indent';
    }
}

function unique(list) {
    var existsSet = {};
    return list.filter(function (item) {
        return !existsSet[item] && (existsSet[item] = true);
    });
}

function tokenDesc(maybeToken) {
    return (maybeToken.description ? maybeToken.description() : maybeToken instanceof RegExp ? tokenDescRx(maybeToken) : tokenDescStr(maybeToken));
}

function tokenDescStr(str) {
    return JSON.stringify(str);
}

function tokenDescRx(rx) {
    return rx.source;
}

function tokenize(p, maybeToken) {
    return (typeof maybeToken === 'string' ? tokenizeStr(p, maybeToken) : maybeToken.tokenize ? maybeToken.tokenize(p) : maybeToken instanceof RegExp ? tokenizeRx(p, maybeToken) : null);
}

function tokenizeStr(p, str) {
    return str === p.source.body.substr(p.offset, str.length) && str;
}

function tokenizeRx(p, rx) {
    if (!rx.__tokenSafe) {
        if (rx.source[0] !== '^') {
            throw new Error('RegExp Token must start with ^');
        }
        rx.__tokenSafe = true;
    }
    var data = rx.exec(p.source.body.substr(p.offset));
    return data && data[0];
}

var StringToken = (function () {
    function StringToken(token, name) {
        this.token = token;
        this.name = name;
        this.token = token;
        this.name = name;
    }
    StringToken.prototype.tokenize = function (p) {
        return tokenizeStr(p, this.token);
    };

    StringToken.prototype.description = function () {
        return this.name || tokenDescStr(this.token);
    };
    return StringToken;
})();

var RegExpToken = (function () {
    function RegExpToken(token, name) {
        this.token = token;
        this.name = name;
        this.token = token;
        this.name = name;
    }
    RegExpToken.prototype.tokenize = function (p) {
        return tokenizeRx(p, this.token);
    };

    RegExpToken.prototype.description = function () {
        return this.name || tokenDescRx(this.token);
    };
    return RegExpToken;
})();
