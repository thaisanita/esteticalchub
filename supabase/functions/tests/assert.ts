// Asserções sem dependências externas (usa o node:assert incluído no Deno),
// para os testes correrem também sem acesso a jsr.io.
import nodeAssert from "node:assert/strict";

export function assert(cond: unknown, msg?: string): asserts cond {
  nodeAssert.ok(cond, msg);
}

export function assertEquals<T>(actual: T, expected: T, msg?: string) {
  nodeAssert.deepStrictEqual(actual, expected, msg);
}

// deno-lint-ignore no-explicit-any
export function assertThrows<E extends Error>(fn: () => unknown, Classe: new (...a: any[]) => E): E {
  try {
    fn();
  } catch (e) {
    nodeAssert.ok(e instanceof Classe, `Esperava ${Classe.name}, recebeu ${e}`);
    return e as E;
  }
  throw new nodeAssert.AssertionError({ message: `Esperava exceção ${Classe.name}` });
}
