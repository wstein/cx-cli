declare module 'yargs' {
  const yargs: any;
  export default yargs;
  export type Argv = any;
  export type Arguments = Record<string, unknown>;
}

declare module 'yargs/helpers' {
  export function hideBin(argv: string[]): string[];
}
