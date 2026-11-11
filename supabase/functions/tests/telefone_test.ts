import { assertEquals } from "./assert.ts";
import { mascararTelefone, normalizarTelefone } from "../_shared/telefone.ts";

Deno.test("1. telefone: formatos aceites", () => {
  const casos: Array<[string, string]> = [
    ["+351 912 345 678", "+351912345678"],
    ["00351912345678", "+351912345678"],
    ["351912345678", "+351912345678"],
    ["912345678", "+351912345678"],
    ["+33 6 12 34 56 78", "+33612345678"],
    ["+1 555-613-6206", "+15556136206"],
    ["(+351) 93-440-3569", "+351934403569"],
  ];
  for (const [entrada, esperado] of casos) {
    assertEquals(normalizarTelefone(entrada), { ok: true, e164: esperado }, entrada);
  }
});

Deno.test("1. telefone: formatos recusados (não adivinha)", () => {
  const casos: Array<[string | null, string]> = [
    ["", "vazio"],
    [null, "vazio"],
    ["212345678", "nao_e_telemovel_pt"],          // fixo PT
    ["33612345678", "formato_ambiguo"],            // sem + não adivinha país
    ["352691234567", "formato_ambiguo"],           // idem (prefixo 352 visto na base)
    ["+3519123456789", "comprimento_invalido"],
    ["+351212345678", "nao_e_telemovel_pt"],
    ["+12", "comprimento_invalido"],
    ["91234abcd", "caracteres_invalidos"],
    ["91+2345678", "caracteres_invalidos"],
    ["+0351912345678", "formato_ambiguo"],
  ];
  for (const [entrada, motivo] of casos) {
    assertEquals(normalizarTelefone(entrada), { ok: false, motivo } as never, String(entrada));
  }
});

Deno.test("telefone: máscara nunca expõe o número completo", () => {
  assertEquals(mascararTelefone("+351912345678"), "+351******678");
  assertEquals(mascararTelefone("+15556136206"), "+15******206");
});
