/**
* Primary entry point, Parser.parse() takes a string and parse function and
* runs the parser.
*
*     Parser.parse(Parser.Source('abc'), myParseFn);
*
*/
export declare function parse<T>(source: Source, parser: (c: Parse) => T, callback?: (error: ParseError, ast: T) => void): T;
/**
* Define tokens.
*/
export declare function token(rx: RegExp, name?: string): Token;
export declare function token(str: string, name?: string): Token;
export interface Token {
    tokenize(p: Parse): string;
    description(): string;
}
/**
* Identify sources.
*/
export declare class Source {
    public body: string;
    public name: string;
    constructor(body: string, name?: string);
}
/**
* A syntax error generated by a Parse.
* Provided as an argument in the callback given to Parse.parse()
* Includes information about the line and column where the error was
* encountered, along with information about what was expected.
*/
export declare class ParseError {
    public location: Location;
    public expected: string[];
    public toString(): string;
}
/**
* Provided as part of a ParseError. Use to provide clear information about
* the parse error.
*/
export declare class Location {
    public source: Source;
    public offset: number;
    constructor(source: Source, offset: number);
    public toString(): string;
    public line(): number;
    public column(): number;
    private lineColumn();
}
/**
* A parsing operation. Chain methods to define and run a parse:
*/
export declare class Parse {
    public source: Source;
    public offset: number;
    /**
    * True if the token is the next to be encountered.
    */
    public isNext(token: Token): boolean;
    public isNext(token: string): boolean;
    public isNext(token: RegExp): boolean;
    /**
    * Expect the token to be consumed, otherwise a syntax error.
    */
    public skip(token: Token): Parse;
    public skip(token: string): Parse;
    public skip(token: RegExp): Parse;
    public skip(parser: (c: Parse) => any): Parse;
    /**
    * Expect the token/parser to be found, otherwise a syntax error.
    * Returns the parsed result.
    */
    public one(token: Token): string;
    public one(token: string): string;
    public one(token: RegExp): string;
    public one<T>(parser: (c: Parse) => T): T;
    public oneOf(...tokenOrParsers: any[]): string;
    public any(token: any, delimiter?: any): {}[];
    public many(token: any, delimiter?: any): {}[];
    /**
    * Runs the parser, returns undefined if the parser failed, but does not
    * result in a ParseError.
    */
    public optional<T>(parser: (c: Parse) => T): T;
    /**
    * Non-consuming look-ahead. Syntax error if it fails.
    */
    public and(token: any): Parse;
    /**
    * Non-consuming look-ahead. Syntax error if it succeeds.
    */
    public not(token: any): Parse;
    /**
    * If newlines are significant, skips a newline with the same indentation.
    */
    public newline(): Parse;
    /**
    * If newlines are significant, skips a newline with more indentation.
    */
    public indent(): Parse;
    /**
    * If newlines are significant, skips a newline with less indentation.
    * Note: Does not consume the newline.
    */
    public dedent(): Parse;
    /**
    * Expect the end of the file, otherwise a syntax error.
    */
    public end(): Parse;
    /**
    * Provide a description and a valid SyntaxError will be returned.
    */
    public expected(tokenDescription: string): void;
    /**
    * Returns a location descriptor for the current state of the Parse.
    *
    * Useful if your AST should have location information.
    */
    public location(): Location;
    /**
    * By default, the parser treats whitespace as significant.
    * To treat it as insignificant, use one of the pushWhitespace methods below
    * and later call popWhitespaceSignificance() to revert to the previous value.
    */
    public popWhitespaceSignificance(): Parse;
    /**
    * In this mode, all whitespace is insignificant, including line breaks.
    */
    public pushWhitespaceInsignificant(): Parse;
    /**
    * In this mode, spaces and tabs are insignificant, but line breaks are not.
    */
    public pushWhitespaceInsignificantSingleLine(): Parse;
    /**
    * In this mode, all spacing is significant, this is the default.
    */
    public pushWhitespaceAllSignificant(): Parse;
    /**
    * Arbitrary data provided to be tracked and retrieved while parsing.
    */
    public context(): any;
    public setContext(context: any): Parse;
    public pushContext(context: any): Parse;
    public popContext(): Parse;
    /**
    * Create a new parse operation from a given source.
    *
    * Usually just call Parser.parse() directly
    */
    constructor(source: Source);
    /**
    * Start a Parse with a given parser.
    */
    public run<T>(parser: (c: Parse) => T, callback?: (error: ParseError, ast: T) => void): T;
    private _context;
    private _depth;
    private _sigWhitespace;
    private _syntaxError;
    private _copy();
    private _resume(c);
    private _whitespace(style?);
    private _line(direction);
    private _list<T>(token, delimiter?, requireOne?);
}
