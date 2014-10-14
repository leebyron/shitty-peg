function invariant(condition, format) {
    if (!condition) {
        throw new Error(format);
    }
}

module.exports = invariant;
