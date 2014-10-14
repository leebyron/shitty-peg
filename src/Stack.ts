'use strict';

class Stack<T> {
  public value: T;
  private _prev: Stack<T>;

  constructor(value?: T) {
    if (emptyStack && value === undefined) {
      return emptyStack;
    }
    this.value = value;
  }

  push(value: T): Stack<T> {
    var stack = new Stack(value);
    stack._prev = this;
    return stack;
  }

  pop(): Stack<T> {
    return this._prev || emptyStack;
  }
}

var emptyStack: Stack<any> = new Stack(undefined);

export = Stack;
