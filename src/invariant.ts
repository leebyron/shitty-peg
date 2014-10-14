function invariant(condition: any, format: string): void {
  if (!condition) {
    throw new Error(format);
  }
}

export = invariant;
