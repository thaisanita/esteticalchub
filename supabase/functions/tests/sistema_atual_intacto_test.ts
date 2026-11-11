// 15. Garantia de que o Baileys e o fluxo atual continuam intactos.
// As hashes foram calculadas a partir do branch main (commit fa95e9d) antes de
// qualquer alteração. Se um destes ficheiros mudar, este teste falha de
// propósito: a mudança tem de ser revista e autorizada.

import { assertEquals } from "./assert.ts";

const RAIZ = new URL("../../../", import.meta.url);

const INTACTOS: Array<[string, string]> = [
  ["whatsapp-bot/src/index.js", "1d49a843d2e61981ceb4dc234429d02233d2197fb098b826d1f99dcb900c0d20"],
  ["whatsapp-bot/src/sessionManager.js", "2c494927e1f45afa3763d09698ba5fe0032957889d014dbe6e362b2de16a7307"],
  ["whatsapp-bot/src/supabaseAdmin.js", "5374630691bf2c495146ba1c95e5280f347b88fe9036122c5a18b35c6591b652"],
  ["whatsapp-bot/package.json", "9a09a5ce47e8a521bae66d40bab980ec816715b7ee5c02b05ae73d4f95438e3d"],
  ["whatsapp-bot/package-lock.json", "f73255e64bafa20349271b892543ca75bdc42e7facec8ded891d1bd05e74361d"],
  ["whatsapp-bot/README.md", "2ae548c47980a86813ca2b7416a992b0c0c31abf245fdfdfec58b25c8365c614"],
  ["supabase/functions/processar-fila/index.ts", "11b01df2886792cf8b14ec43e42228223bb02cc999b21360cfab092d72609d1f"],
  ["supabase_migration_fila_notificacoes_envio.sql", "643bb7119180bf7ce658870cf52296556ac8053c466a37fe84aa73228607b5cf"],
  ["supabase_migration_whatsapp_bot.sql", "b358bc1aadd34748d1dff5b12ac648477fedcd0ee4b8743f748233a65dc1e558"],
  ["src/pages/NovoAgendamento.tsx", "de356cab5c73b495471c71def22d723dfc37ff587130d21062e040f1fa832bd5"],
  ["supabase/functions/excluir-conta/index.ts", "3caca6f5f8900e2cece88bc219865aad7832b5e7ab031a5ad50c45e9c19e1688"],
];

async function sha256(caminho: string) {
  const bytes = await Deno.readFile(new URL(caminho, RAIZ));
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

for (const [ficheiro, esperado] of INTACTOS) {
  Deno.test(`15. intacto: ${ficheiro}`, async () => {
    assertEquals(await sha256(ficheiro), esperado);
  });
}

Deno.test("15. a migration nova não redefine reivindicar_notificacoes nem o cron", async () => {
  const sql = await Deno.readTextFile(new URL("supabase_migration_whatsapp_cloud.sql", RAIZ));
  const semComentarios = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assertEquals(/function\s+public\.reivindicar_notificacoes\b/i.test(semComentarios), false);
  assertEquals(/cron\.(schedule|unschedule|alter_job)/i.test(semComentarios), false);
  assertEquals(/drop\s+(table|column|policy\s+if\s+exists\s+"fila_notificacoes)/i.test(semComentarios), false);
});
