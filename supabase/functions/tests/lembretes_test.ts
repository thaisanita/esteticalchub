// Núcleo do worker com um repositório em memória que imita as regras das funções
// SQL. As próprias funções SQL são testadas em supabase/tests/sql.

import { assert, assertEquals } from "./assert.ts";
import {
  ArgsReserva,
  Enviador,
  Preparado,
  PreparadoOk,
  processarLembretesWhatsappCloud,
  RepositorioWhatsappCloud,
  Reserva,
} from "../_shared/lembretes-whatsapp-cloud.ts";
import { ConfigWhatsappCloud, hashTelefone, PedidoTemplate, ResultadoEnvio } from "../_shared/whatsapp-cloud.ts";

const CONFIG: ConfigWhatsappCloud = { accessToken: "t", phoneNumberId: "123456", graphApiVersion: "v26.0", timeoutMs: 1000 };
const PEPPER = "pepper-ficticio-de-teste-com-32-caracteres!";
const hash = (e164: string) => hashTelefone(e164, PEPPER);

function prep(over: Partial<PreparadoOk> = {}): PreparadoOk {
  return {
    ok: true, fila_id: "f1", usuario_id: "22222222-2222-4222-8222-222222222222",
    agendamento_id: "11111111-1111-4111-8111-111111111111", tipo: "lembrete", antecedencia: "1_dia",
    versao_marcacao: "2026-11-12T15:00", telefone: "912345678", cliente_nome: "Ana Silva",
    profissional_nome: "Estúdio X", data: "2026-11-12", hora: "15:00", procedimento: "Microblading",
    tentativa_fila: 1, ...over,
  };
}

type Linha = { id: string; preparado: Preparado; depoisDaReserva?: Preparado };

function repoFalso(linhas: Linha[], opts: { reservar?: (a: ArgsReserva) => Reserva | null; confirmar?: { ok: boolean; motivo?: string } } = {}) {
  const chaves = new Map<string, string>();
  const registos: Array<Record<string, unknown>> = [];
  const cancelados: Array<[string, string]> = [];
  const adiados: Array<[string, number, string]> = [];
  const libertados: Array<[string, string]> = [];
  const reservas: ArgsReserva[] = [];
  const chamadasPreparar = new Map<string, number>();
  let reivindicado = false;
  const repo: RepositorioWhatsappCloud = {
    expirarReservas: () => Promise.resolve(0),
    reivindicar: () => {
      if (reivindicado) return Promise.resolve([]);
      reivindicado = true;
      return Promise.resolve(linhas.map((l) => ({ id: l.id, tentativas: 1 })));
    },
    preparar: (id) => {
      const l = linhas.find((x) => x.id === id)!;
      const n = (chamadasPreparar.get(id) ?? 0) + 1;
      chamadasPreparar.set(id, n);
      return Promise.resolve(n > 1 && l.depoisDaReserva ? l.depoisDaReserva : l.preparado);
    },
    reservar: (a) => {
      reservas.push(a);
      const forcado = opts.reservar?.(a);
      if (forcado) return Promise.resolve(forcado);
      const existente = chaves.get(a.chave);
      if (existente && existente !== "pendente" && existente !== "cancelado") {
        return Promise.resolve({ reservado: false, motivo: "duplicado", estado_existente: existente });
      }
      chaves.set(a.chave, "reservado");
      return Promise.resolve({ reservado: true, envio_id: `e-${a.filaId}` });
    },
    confirmarReserva: () => Promise.resolve(opts.confirmar ?? { ok: true }),
    libertarReserva: (_envioId, filaId, motivo) => {
      libertados.push([filaId, motivo]);
      for (const [k, v] of chaves) if (v === "reservado") chaves.set(k, "cancelado");
      return Promise.resolve();
    },
    adiar: (filaId, minutos, motivo) => {
      adiados.push([filaId, minutos, motivo]);
      return Promise.resolve();
    },
    registarResultado: (a) => {
      registos.push(a);
      const estado = a.resultado === "aceite" ? "aceite" : a.resultado === "incerto" ? "desconhecido" : a.retentavel ? "pendente" : "falhado";
      for (const [k, v] of chaves) if (v === "reservado") chaves.set(k, estado);
      return Promise.resolve(estado === "pendente" ? "nova_tentativa_agendada" : estado);
    },
    cancelar: (id, motivo) => {
      cancelados.push([id, motivo]);
      return Promise.resolve();
    },
  };
  return { repo, registos, cancelados, adiados, libertados, reservas };
}

function enviadorFixo(res: ResultadoEnvio, chamadas: PedidoTemplate[] = []): Enviador {
  return (_c, p) => {
    chamadas.push(p);
    return Promise.resolve(res);
  };
}
const ACEITE: ResultadoEnvio = { resultado: "aceite", wamid: "wamid.1", http: 200 };
const base = { hashTelefone: hash, log: () => {} };

Deno.test("aceite: telefone e dados vêm da BASE DE DADOS; à reserva só vão hash e máscara", async () => {
  const { repo, registos, reservas } = repoFalso([{ id: "f1", preparado: prep() }]);
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, enviar: enviadorFixo(ACEITE, chamadas) });
  assertEquals(c.aceites, 1);
  assertEquals(chamadas[0].telefone, "+351912345678");
  assertEquals(chamadas[0].parametros, ["Ana", "Estúdio X", "12/11", "15:00", "Microblading"]);
  assertEquals(registos[0].wamid, "wamid.1");
  assertEquals(reservas[0].phoneNumberId, "123456");
  assertEquals(reservas[0].telefoneHash, await hash("+351912345678"));
  assertEquals(reservas[0].telefoneMascarado, "+351******678");
  assert(!JSON.stringify(reservas[0]).includes("912345678"));
});

Deno.test("4. resultado incerto => registado como incerto e NUNCA reenviado", async () => {
  const { repo, registos } = repoFalso([{ id: "f1", preparado: prep() }]);
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, {
    ...base, enviar: enviadorFixo({ resultado: "incerto", codigo: "timeout", detalhe: "" }, chamadas),
  });
  assertEquals([c.incertas, chamadas.length, registos[0].resultado], [1, 1, "incerto"]);
  const c2 = await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, enviar: enviadorFixo(ACEITE, chamadas) });
  assertEquals([c2.reivindicadas, chamadas.length], [0, 1]);
});

Deno.test("rejeição temporária confirmada => nova tentativa com espera; definitiva => sem nova tentativa", async () => {
  const r1 = repoFalso([{ id: "f1", preparado: prep() }]);
  const c1 = await processarLembretesWhatsappCloud(r1.repo, CONFIG, {
    ...base, atrasoBaseSegundos: 60,
    enviar: enviadorFixo({ resultado: "rejeitado", retentavel: true, codigo: "meta_130429", detalhe: "", http: 429 }),
  });
  assertEquals([c1.novas_tentativas, r1.registos[0].atrasoSegundos], [1, 60]);
  const r2 = repoFalso([{ id: "f1", preparado: prep() }]);
  const c2 = await processarLembretesWhatsappCloud(r2.repo, CONFIG, {
    ...base, enviar: enviadorFixo({ resultado: "rejeitado", retentavel: false, codigo: "meta_132001", detalhe: "", http: 404 }),
  });
  assertEquals([c2.rejeitadas, c2.novas_tentativas], [1, 0]);
});

Deno.test("3. sem consentimento / telefone inválido => cancela sem chamar a Meta", async () => {
  const { repo, cancelados } = repoFalso([
    { id: "f1", preparado: { ok: false, motivo: "sem_consentimento_whatsapp" } },
    { id: "f2", preparado: prep({ telefone: "212345678" }) },
  ]);
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, enviar: enviadorFixo(ACEITE, chamadas) });
  assertEquals([c.canceladas, chamadas.length], [2, 0]);
  assertEquals(cancelados, [["f1", "sem_consentimento_whatsapp"], ["f2", "telefone_invalido:nao_e_telemovel_pt"]]);
});

Deno.test("1. limite atingido (número ou profissional) => linha ADIADA, não cancelada nem enviada", async () => {
  for (const motivo of ["limite_diario_numero", "limite_diario_profissional", "numero_inativo"]) {
    const { repo, adiados, cancelados } = repoFalso([{ id: "f1", preparado: prep() }], {
      reservar: () => ({ reservado: false, motivo }),
    });
    const chamadas: PedidoTemplate[] = [];
    const c = await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, minutosAdiamento: 30, enviar: enviadorFixo(ACEITE, chamadas) });
    assertEquals([c.adiadas, chamadas.length, cancelados.length], [1, 0, 0], motivo);
    assertEquals(adiados[0], ["f1", 30, motivo]);
  }
});

Deno.test("2. telefone com opt-out (bloqueio global) => cancelado sem envio", async () => {
  const { repo, cancelados } = repoFalso([{ id: "f1", preparado: prep() }], {
    reservar: () => ({ reservado: false, motivo: "bloqueado_opt_out" }),
  });
  const chamadas: PedidoTemplate[] = [];
  await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, enviar: enviadorFixo(ACEITE, chamadas) });
  assertEquals(chamadas.length, 0);
  assertEquals(cancelados, [["f1", "bloqueado_opt_out"]]);
});

Deno.test("4. alteração entre a reserva e o envio => reserva libertada, nada enviado", async () => {
  const casos: Array<[Preparado, string]> = [
    [prep({ versao_marcacao: "2026-11-12T16:00", hora: "16:00" }), "marcacao_alterada"],
    [prep({ telefone: "+351934403569" }), "telefone_alterado"],
    [{ ok: false, motivo: "marcacao_cancelada" }, "marcacao_cancelada"],
  ];
  for (const [depois, motivo] of casos) {
    const { repo, libertados } = repoFalso([{ id: "f1", preparado: prep(), depoisDaReserva: depois }]);
    const chamadas: PedidoTemplate[] = [];
    const c = await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, enviar: enviadorFixo(ACEITE, chamadas) });
    assertEquals([c.libertadas_antes_de_enviar, chamadas.length], [1, 0], motivo);
    assertEquals(libertados[0], ["f1", motivo]);
  }
});

Deno.test("confirmação final falha (fila apagada / PARAR entretanto) => nada enviado", async () => {
  const { repo } = repoFalso([{ id: "f1", preparado: prep() }], { confirmar: { ok: false, motivo: "fila_apagada" } });
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, enviar: enviadorFixo(ACEITE, chamadas) });
  assertEquals([c.libertadas_antes_de_enviar, chamadas.length], [1, 0]);
});

Deno.test("4. mesma marcação e mesma DATA (fila recriada ou só a hora mudou) => 1 envio", async () => {
  const { repo, cancelados } = repoFalso([
    { id: "f1", preparado: prep() },
    { id: "f2", preparado: prep({ fila_id: "f2", hora: "17:00", versao_marcacao: "2026-11-12T17:00" }) },
  ]);
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, enviar: enviadorFixo(ACEITE, chamadas) });
  assertEquals([c.aceites, c.duplicadas, chamadas.length], [1, 1, 1]);
  assertEquals(cancelados[0], ["f2", "duplicado:aceite"]);
});

Deno.test("remarcação para OUTRO dia => nova chave => novo lembrete", async () => {
  const { repo } = repoFalso([
    { id: "f1", preparado: prep() },
    { id: "f2", preparado: prep({ fila_id: "f2", data: "2026-11-13", versao_marcacao: "2026-11-13T15:00" }) },
  ]);
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, enviar: enviadorFixo(ACEITE) });
  assertEquals([c.aceites, c.duplicadas], [2, 0]);
});

Deno.test("14. isolamento: profissional_nao_corresponde / cliente_de_outra_agenda cancelam", async () => {
  const { repo, cancelados } = repoFalso([
    { id: "f1", preparado: { ok: false, motivo: "profissional_nao_corresponde" } },
    { id: "f2", preparado: { ok: false, motivo: "cliente_de_outra_agenda" } },
  ]);
  const chamadas: PedidoTemplate[] = [];
  await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, enviar: enviadorFixo(ACEITE, chamadas) });
  assertEquals(chamadas.length, 0);
  assertEquals(cancelados.map((c) => c[1]), ["profissional_nao_corresponde", "cliente_de_outra_agenda"]);
});

Deno.test("prazo da execução esgotado => linhas restantes devolvidas sem gastar tentativa", async () => {
  const { repo, adiados } = repoFalso([{ id: "f1", preparado: prep() }, { id: "f2", preparado: prep({ fila_id: "f2", data: "2026-11-14" }) }]);
  let t = 0;
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, {
    ...base, prazoMs: 100, agora: () => (t += 60), enviar: enviadorFixo(ACEITE),
  });
  assertEquals([c.aceites, c.nao_processadas_por_tempo], [1, 1]);
  assertEquals(adiados[0], ["f2", 0, "sem_tempo_nesta_execucao"]);
});

Deno.test("erro interno depois da reserva não provoca reenvio", async () => {
  const { repo } = repoFalso([{ id: "f1", preparado: prep() }]);
  repo.registarResultado = () => Promise.reject(new Error("db caiu"));
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, { ...base, enviar: enviadorFixo(ACEITE, chamadas) });
  assertEquals([c.erros_internos, chamadas.length], [1, 1]);
});

Deno.test("logs não contêm o telefone completo nem o hash", async () => {
  const linhasLog: string[] = [];
  const { repo } = repoFalso([{ id: "f1", preparado: prep() }]);
  await processarLembretesWhatsappCloud(repo, CONFIG, {
    hashTelefone: hash, log: (m) => linhasLog.push(m), enviar: enviadorFixo({ resultado: "incerto", codigo: "timeout", detalhe: "" }),
  });
  const h = await hash("+351912345678");
  assert(linhasLog.length > 0);
  assert(linhasLog.every((l) => !l.includes("912345678") && !l.includes(h)));
});
