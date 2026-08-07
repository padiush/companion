/**
 * The slice of Node's built-in `node:sqlite` that the test harness uses.
 *
 * Declared locally rather than by adding `node` to tsconfig's `types`: that
 * would pull Node's globals into a React Native program, where they collide
 * with RN's own (`setTimeout` returning a `Timeout` rather than a number, and
 * so on). Nothing outside `test-utils/` should need Node types.
 */
declare module 'node:sqlite' {
  export interface StatementSync {
    run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
