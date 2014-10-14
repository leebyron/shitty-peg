declare class Stack<T> {
    public value: T;
    private _prev;
    constructor(value?: T);
    public push(value: T): Stack<T>;
    public pop(): Stack<T>;
}
export = Stack;
