import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  suite,
  vi,
  it as vitestIt,
  test as vitestTest,
} from "vitest";

type TestHandler = () => unknown | Promise<unknown>;
type TestOptions = {
  timeout?: number;
};
type MockModuleFactory = () => unknown | Promise<unknown>;

const mockedSpecifiers = new Set<string>();

expect.extend({
  toEndWith(received: string, expected: string) {
    const pass = received.endsWith(expected);
    return {
      pass,
      message: () =>
        `expected ${JSON.stringify(received)} ${pass ? "not " : ""}to end with ${JSON.stringify(expected)}`,
    };
  },
  toStartWith(received: string, expected: string) {
    const pass = received.startsWith(expected);
    return {
      pass,
      message: () =>
        `expected ${JSON.stringify(received)} ${pass ? "not " : ""}to start with ${JSON.stringify(expected)}`,
    };
  },
});

function runCompatTest(
  api: typeof vitestTest | typeof vitestIt,
  name: string,
  fnOrOptions?: TestHandler | TestOptions,
  maybeOptions?: TestOptions,
) {
  if (typeof fnOrOptions === "function") {
    return api(name, maybeOptions ?? {}, fnOrOptions);
  }
  return api(name, fnOrOptions ?? {}, () => undefined);
}

const mock = Object.assign(
  <TArgs extends unknown[] = unknown[], TResult = unknown>(
    implementation?: (...args: TArgs) => TResult,
  ) => vi.fn(implementation),
  {
    module(specifier: string, factory: MockModuleFactory) {
      mockedSpecifiers.add(specifier);
      vi.doMock(specifier, factory as Parameters<typeof vi.doMock>[1]);
    },
    restore() {
      for (const specifier of mockedSpecifiers) {
        vi.doUnmock(specifier);
      }
      mockedSpecifiers.clear();
      vi.clearAllMocks();
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.resetModules();
    },
  },
);

const test = Object.assign(
  (
    name: string,
    fnOrOptions?: TestHandler | TestOptions,
    maybeOptions?: TestOptions,
  ) => runCompatTest(vitestTest, name, fnOrOptions, maybeOptions),
  {
    skip: (...args: Parameters<typeof vitestTest.skip>) =>
      vitestTest.skip(...args),
    only: (...args: Parameters<typeof vitestTest.only>) =>
      vitestTest.only(...args),
    todo: (...args: Parameters<typeof vitestTest.todo>) =>
      vitestTest.todo(...args),
    each: (...args: Parameters<typeof vitestTest.each>) =>
      vitestTest.each(...args),
    fails: (...args: Parameters<typeof vitestTest.fails>) =>
      vitestTest.fails(...args),
    concurrent: (...args: Parameters<typeof vitestTest.concurrent>) =>
      vitestTest.concurrent(...args),
    sequential: (...args: Parameters<typeof vitestTest.sequential>) =>
      vitestTest.sequential(...args),
  },
) as unknown as typeof vitestTest;

const it = Object.assign(
  (
    name: string,
    fnOrOptions?: TestHandler | TestOptions,
    maybeOptions?: TestOptions,
  ) => runCompatTest(vitestIt, name, fnOrOptions, maybeOptions),
  {
    skip: (...args: Parameters<typeof vitestIt.skip>) => vitestIt.skip(...args),
    only: (...args: Parameters<typeof vitestIt.only>) => vitestIt.only(...args),
    todo: (...args: Parameters<typeof vitestIt.todo>) => vitestIt.todo(...args),
    each: (...args: Parameters<typeof vitestIt.each>) => vitestIt.each(...args),
    fails: (...args: Parameters<typeof vitestIt.fails>) =>
      vitestIt.fails(...args),
    concurrent: (...args: Parameters<typeof vitestIt.concurrent>) =>
      vitestIt.concurrent(...args),
    sequential: (...args: Parameters<typeof vitestIt.sequential>) =>
      vitestIt.sequential(...args),
  },
) as unknown as typeof vitestIt;

export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  suite,
  test,
};
