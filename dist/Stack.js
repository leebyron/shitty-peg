'use strict';
var Stack = (function () {
    function Stack(value) {
        if (emptyStack && value === undefined) {
            return emptyStack;
        }
        this.value = value;
    }
    Stack.prototype.push = function (value) {
        var stack = new Stack(value);
        stack._prev = this;
        return stack;
    };

    Stack.prototype.pop = function () {
        return this._prev || emptyStack;
    };
    return Stack;
})();

var emptyStack = new Stack(undefined);

module.exports = Stack;
