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
        var unexpected = this.location.offset === this.location.source.body.length ? 'EOF' : readableToken(this.location.source.body[this.location.offset]);
        return 'Syntax error: unexpected "' + unexpected + '". ' + 'Expected ' + this.expected.join(' or ') + ' at ' + this.location;
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
    /**
    * Create a new parse operation from a given source.
    */
    function Parse(source) {
        this._source = source;
        this._context = new Stack();
        this._offset = 0;
        this._depth = new Stack(0);
        this._sigWhitespace = new Stack(3 /* NONE */);
        this._syntaxError = new ParseError();
        this._syntaxError.location = new Location(source, 0);
    }
    Parse.prototype.run = function (parser, callback) {
        this._offset = 0;
        try  {
            var ast = parser(this);
            this.eof();
            callback && callback(null, ast);
            return ast;
        } catch (error) {
            if (error !== this._syntaxError) {
                throw error;
            }

            // Clean up the error.
            this._syntaxError.expected = unique(this._syntaxError.expected).map(readableToken);
            if (callback) {
                callback(this._syntaxError, null);
            } else {
                throw new Error(this._syntaxError.toString());
            }
        }
    };

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
    * Returns a location descriptor for the current token.
    */
    Parse.prototype.location = function () {
        this._whitespace();
        return new Location(this._source, this._offset);
    };

    /**
    * True if the token is the next to be encountered.
    */
    Parse.prototype.isNext = function (token) {
        this._whitespace();
        return token === this._source.body.substring(this._offset, this._offset + token.length);
    };

    /**
    * True if the token was encountered and consumed.
    */
    Parse.prototype.maybe = function (token) {
        var exists = this.isNext(token);
        if (exists) {
            this._offset += token.length;
        }
        return exists;
    };

    /**
    * Expect the token to be consumed, otherwise a syntax error.
    */
    Parse.prototype.expect = function (token) {
        if (!this.isNext(token)) {
            this._expected(token);
        }
        this._offset += token.length;
        return this;
    };

    Parse.prototype.one = function (parser, mapper) {
        var type = typeof parser;
        if (type === 'function') {
            return parser(this);
        }
        if (type === 'string') {
            this.expect(parser);
            return arguments.length === 2 ? mapper : parser;
        }
        if (parser instanceof RegExp) {
            return this._regexp(parser, mapper);
        }
    };

    /**
    * Expect the end of the file, otherwise a syntax error.
    */
    Parse.prototype.eof = function () {
        this._whitespace(2 /* MULTI_LINE */);
        if (this._offset !== this._source.body.length) {
            this._expected('EOF');
        }
        return this;
    };

    /**
    * If newlines are significant, expects a newline with the same indentation.
    */
    Parse.prototype.newline = function () {
        return this._line(0);
    };

    /**
    * If newlines are significant, expects a newline with more indentation.
    */
    Parse.prototype.indent = function () {
        return this._line(1);
    };

    /**
    * If newlines are significant, expects a newline with less indentation.
    * Note: Does not consume the newline.
    */
    Parse.prototype.dedent = function () {
        var c = this;
        if (c._offset === c._source.body.length) {
            return c;
        }
        return c._line(-1);
    };

    /**
    * Runs each parser in order, stopping once one has completed without
    * encountering a ParseError. If all parsers fail, the one which parsed
    * the furthest will present it's ParseError.
    */
    //oneOf<T>(...parsers: Array<(c: Parse) => T>): T;
    Parse.prototype.oneOf = function () {
        var parsers = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            parsers[_i] = arguments[_i + 0];
        }
        var bestError;
        for (var ii = 0; ii < parsers.length; ii++) {
            try  {
                var copy = this._copy();
                var result = copy.one(parsers[ii]);
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
    * Runs the parser, returns undefined if the parser failed, but does not
    * result in a ParseError.
    */
    Parse.prototype.optional = function (parser) {
        try  {
            var copy = this._copy();
            var result = parser(copy);
            this._resume(copy);
            return result;
        } catch (error) {
            if (error !== this._syntaxError) {
                throw error;
            }
        }
    };

    /**
    * Runs the parser as many times as possible, running the delimiterParser
    * between each run. Continues until a parser fails, returns an array of
    * parse results.
    */
    //any(token: string, delimiter?: (c: Parse) => any): string[];
    //any(token: string, delimiter?: string): string[];
    //any(token: string, delimiter?: RegExp): string[];
    //any(regex: RegExp, delimiter?: (c: Parse) => any): string[];
    //any(regex: RegExp, delimiter?: string): string[];
    //any(regex: RegExp, delimiter?: RegExp): string[];
    //any<T>(parser: (c: Parse) => T, delimiter?: (c: Parse) => any): T[];
    //any<T>(parser: (c: Parse) => T, delimiter?: string): T[];
    //any<T>(parser: (c: Parse) => T, delimiter?: RegExp): T[];
    Parse.prototype.any = function (token, delimiter) {
        return this._list(token, delimiter, false);
    };

    /**
    * Like any(), but expects at least one successful parse.
    */
    //many(token: string, delimiter?: (c: Parse) => any): string[];
    //many(token: string, delimiter?: string): string[];
    //many(token: string, delimiter?: RegExp): string[];
    //many(regex: RegExp, delimiter?: (c: Parse) => any): string[];
    //many(regex: RegExp, delimiter?: string): string[];
    //many(regex: RegExp, delimiter?: RegExp): string[];
    //many<T>(parser: (c: Parse) => T, delimiter?: (c: Parse) => any): T[];
    //many<T>(parser: (c: Parse) => T, delimiter?: string): T[];
    //many<T>(parser: (c: Parse) => T, delimiter?: RegExp): T[];
    Parse.prototype.many = function (token, delimiter) {
        return this._list(token, delimiter, true);
    };

    Parse.prototype._copy = function () {
        return (new Parse(this._source))._resume(this);
    };

    Parse.prototype._resume = function (c) {
        if (this !== c) {
            this._source = c._source;
            this._context = c._context;
            this._offset = c._offset;
            this._depth = c._depth;
            this._sigWhitespace = c._sigWhitespace;
            this._syntaxError = c._syntaxError;
        }
        return this;
    };

    Parse.prototype._expected = function (token) {
        if (this._offset > this._syntaxError.location.offset) {
            this._syntaxError.location.offset = this._offset;
            this._syntaxError.expected.length = 0;
        }
        if (this._offset >= this._syntaxError.location.offset) {
            this._syntaxError.expected.push(token);
        }
        throw this._syntaxError;
    };

    Parse.prototype._whitespace = function (style) {
        style = style || this._sigWhitespace.value;
        if (style === 3 /* NONE */) {
            return this;
        }
        var allowNewline = style === 2 /* MULTI_LINE */;
        while (true) {
            var charAt = this._source.body[this._offset];
            if (charAt === ' ' || charAt === '\t' || charAt === '\r' || (allowNewline && charAt === '\n')) {
                this._offset += 1;
            } else if (charAt === '\\') {
                if (this._source.body[this._offset + 1] === '\n') {
                    this._offset += 2;
                }
            } else {
                break;
            }
        }
        return this;
    };

    Parse.prototype._line = function (direction) {
        var style = this._sigWhitespace.value;
        invariant(style !== 2 /* MULTI_LINE */, 'Cannot parse significant lines when white space is insignificant');
        var c = this._whitespace();
        if (direction === -1) {
            c = c._copy();
        }
        var depth;
        c = c.pushWhitespaceAllSignificant();
        do {
            c = c.expect('\n');
            depth = 0;
            while (c.isNext(' ') || c.isNext('\t')) {
                if (c.isNext(' ')) {
                    depth += 1;
                } else if (c.isNext('\t')) {
                    depth += 2;
                }
                c._offset += 1;
            }
        } while(c.isNext('\n'));
        c = c.popWhitespaceSignificance();

        var currentDepth = this._depth.value;
        if (direction === 0) {
            if (depth !== currentDepth) {
                this._expected('newline');
            }
            this._resume(c);
        } else if (direction === 1) {
            if (depth <= currentDepth) {
                this._expected('indent');
            }
            this._resume(c);
            this._depth = this._depth.push(depth);
        } else if (direction === -1) {
            var prevDepth = this._depth.pop().value;
            if (depth > prevDepth) {
                this._expected('dedent');
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

    Parse.prototype._regexp = function (regex, mapper) {
        invariant(regex.global, 'Must provide global RegExp.');
        this._whitespace();
        regex.lastIndex = this._offset;
        var data = regex.exec(this._source.body);
        if (!data || data.index !== this._offset) {
            var expected = '/' + regex.source + '/';
            var name = regex.name;
            if (name) {
                expected = name + ' ' + expected;
            }
            this._expected(expected);
        }
        this._offset += data[0].length;
        return mapper ? mapper(data) : data[0];
    };
    return Parse;
})();
exports.Parse = Parse;

var WhiteSpaceStyle;
(function (WhiteSpaceStyle) {
    WhiteSpaceStyle[WhiteSpaceStyle["SINGLE_LINE"] = 1] = "SINGLE_LINE";
    WhiteSpaceStyle[WhiteSpaceStyle["MULTI_LINE"] = 2] = "MULTI_LINE";
    WhiteSpaceStyle[WhiteSpaceStyle["NONE"] = 3] = "NONE";
})(WhiteSpaceStyle || (WhiteSpaceStyle = {}));

function unique(list) {
    var existsSet = {};
    return list.filter(function (item) {
        return !existsSet[item] && (existsSet[item] = true);
    });
}

function readableToken(token) {
    switch (token) {
        case '\n':
            return '\\n';
        case ' ':
            return '<sp>';
        default:
            return token;
    }
}
