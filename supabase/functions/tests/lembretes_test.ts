// Testes do núcleo do worker com um repositório em memória que imita as regras
// das funções SQL (as próprias funções SQL são testadas em supabase/tests/sql).

import { assert, assertEquals } from "./assert.ts";
import {
  Enviador,
  Preparado,
  processarLembretesWhatsappCloud,
  RepositorioWhatsappCloud,
} from "../_shared/lembretes-whatsapp-cloud.ts";
import { ConfigWhatsappCloud, PedidoTemplate, ResultadoEnvio } from "../_shared/whatsapp-cloud.ts";

const CONFIG: ConfigWhatsappCloud = { accessToken: "t", phoneNumberId: "123456", graphApiVersion: "v26.0", timeoutMs: 1000 };

function prep(over: Partial<Extract<Preparado, { ok: true }>> = {}): Preparado {
  return {
    ok: true,
    fila_id: "f1",
    usuario_id: "22222222-2222-4222-8222-222222222222",
    agendamento_id: "11111111-1111-4111-8111-111111111111",
    tipo: "lembrete",
    antecedencia: "1_dia",
    versao_marcacao: "2026-11-12T15:00",
    telefone: "912345678",
    cliente_nome: "Ana Silva",
    profissional_nome: "Estúdio X",
    data: "2026-11-12",
    hora: "15:00",
    procedimento: "Microblading",
    tentativa_fila: 1,
    ...over,
  };
}

function repoFalso(linhas: Array<{ id: string; preparado: Preparado }>) {
  const chaves = new Map<string, string>(); // chave -> estado
  const registos: Array<Record<string, unknown>> = [];
  const cancelados: Array<[string, string]> = [];
  let reivindicado = false;
  const repo: RepositorioWhatsappCloud = {
    expirarReservas: () => Promise.resolve(0),
    reivindicar: () => {
      if (reivindicado) return Promise.resolve([]);
      reivindicado = true;
      return Promise.resolve(linhas.map((l) => ({ id: l.id, tentativas: 1 })));
    },
    preparar: (id) => Promise.resolve(linhas.find((l) => l.id === id)!.preparado),
    reservar: (a) => {
      const existente = chaves.get(a.chave);
      if (existente && existente !== "pendente") return Promise.resolve({ reservado: false, estado_existente: existente });
      chaves.set(a.chave, "reservado");
      return Promise.resolve({ reservado: true, envio_id: `e-${a.filaId}` });
    },
    registarResultado: (a) => {
      registos.push(a);
      const estado = a.resultado === "aceite" ? "aceite" : a.resultado === "incerto" ? "desconhecido"
        : a.retentavel ? "pendente" : "falhado";
      for (const [k, v] of chaves) if (v === "reservado") chaves.set(k, estado);
      return Promise.resolve(estado === "pendente" ? "nova_tentativa_agendada" : estado);
    },
    cancelar: (id, motivo) => {
      cancelados.push([id, motivo]);
      return Promise.resolve();
    },
  };
  return { repo, registos, cancelados, chaves };
}

function enviadorFixo(res: ResultadoEnvio, chamadas: PedidoTemplate[] = []): Enviador {
  return (_c, p) => {
    chamadas.push(p);
    return Promise.resolve(res);
  };
}

const silencioso = { log: () => {} };

Deno.test("aceite: usa telefone e dados da BASE DE DADOS, não da fila", async () => {
  const { repo, registos } = repoFalso([{ id: "f1", preparado: prep() }]);
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, {
    ...silencioso,
    enviar: enviadorFixo({ resultado: "aceite", wamid: "wamid.1", http: 200 }, chamadas),
  });
  assertEquals(c.aceites, 1);
  assertEquals(chamadas[0].telefone, "+351912345678");
  assertEquals(chamadas[0].template, "lembrete_marcacao_24h");
  assertEquals(chamadas[0].idioma, "pt_PT");
  assertEquals(chamadas[0].parametros, ["Ana", "Estúdio X", "12/11", "15:00", "Microblading"]);
  assertEquals(registos[0].resultado, "aceite");
  assertEquals(registos[0].wamid, "wamid.1");
});

Deno.test("4. resultado incerto é registado como incerto e NUNCA reenviado", async () => {
  const { repo, registos } = repoFalso([{ id: "f1", preparado: prep() }]);
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, {
    ...silencioso,
    enviar: enviadorFixo({ resultado: "incerto", codigo: "timeout", detalhe: "" }, chamadas),
  });
  assertEquals([c.incertas, chamadas.length], [1, 1]);
  assertEquals(registos[0].resultado, "incerto");
  // uma nova execução não volta a pegar na linha (o repositório já não a devolve)
  const c2 = await processarLembretesWhatsappCloud(repo, CONFIG, { ...silencioso, enviar: enviadorFixo({ resultado: "aceite", wamid: "x", http: 200 }, chamadas) });
  assertEquals([c2.reivindicadas, chamadas.length], [0, 1]);
});

Deno.test("rejeição temporária confirmada agenda nova tentativa com espera crescente", async () => {
  const { repo, registos } = repoFalso([{ id: "f1", preparado: prep() }]);
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, {
    ...silencioso,
    atrasoBaseSegundos: 60,
    enviar: enviadorFixo({ resultado: "rejeitado", retentavel: true, codigo: "meta_130429", detalhe: "", http: 429 }),
  });
  assertEquals(c.novas_tentativas, 1);
  assertEquals(registos[0].retentavel, true);
  assertEquals(registos[0].atrasoSegundos, 60);
});

Deno.test("rejeição definitiva => falhado, sem nova tentativa", async () => {
  const { repo } = repoFalso([{ id: "f1", preparado: prep() }]);
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, {
    ...silencioso,
    enviar: enviadorFixo({ resultado: "rejeitado", retentavel: false, codigo: "meta_132001", detalhe: "", http: 404 }),
  });
  assertEquals([c.rejeitadas, c.novas_tentativas], [1, 0]);
});

Deno.test("validação falhada no servidor cancela sem chamar a Meta", async () => {
  const { repo, cancelados } = repoFalso([
    { id: "f1", preparado: { ok: false, motivo: "sem_consentimento_whatsapp" } },
    { id: "f2", preparado: prep({ telefone: "212345678" }) },
  ]);
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, {
    ...silencioso,
    enviar: enviadorFixo({ resultado: "aceite", wamid: "x", http: 200 }, chamadas),
  });
  assertEquals(c.canceladas, 2);
  assertEquals(chamadas.length, 0);
  assertEquals(cancelados, [["f1", "sem_consentimento_whatsapp"], ["f2", "telefone_invalido:nao_e_telemovel_pt"]]);
});

Deno.test("2 linhas da mesma marcação/versão (fila recriada) => só 1 envio", async () => {
  const { repo, cancelados } = repoFalso([
    { id: "f1", preparado: prep() },
    { id: "f2", preparado: prep({ fila_id: "f2" }) },
  ]);
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, {
    ...silencioso,
    enviar: enviadorFixo({ resultado: "aceite", wamid: "wamid.1", http: 200 }, chamadas),
  });
  assertEquals([c.aceites, c.duplicadas, chamadas.length], [1, 1, 1]);
  assertEquals(cancelados[0], ["f2", "duplicado:aceite"]);
});

Deno.test("remarcação (nova data/hora) => nova chave => novo lembrete permitido", async () => {
  const { repo } = repoFalso([
    { id: "f1", preparado: prep() },
    { id: "f2", preparado: prep({ fila_id: "f2", versao_marcacao: "2026-11-13T10:00", data: "2026-11-13", hora: "10:00" }) },
  ]);
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, {
    ...silencioso,
    enviar: enviadorFixo({ resultado: "aceite", wamid: "wamid.1", http: 200 }, chamadas),
  });
  assertEquals([c.aceites, c.duplicadas], [2, 0]);
});

Deno.test("14. isolamento: profissional_nao_corresponde / cliente_de_outra_agenda cancelam", async () => {
  const { repo, cancelados } = repoFalso([
    { id: "f1", preparado: { ok: false, motivo: "profissional_nao_corresponde" } },
    { id: "f2", preparado: { ok: false, motivo: "cliente_de_outra_agenda" } },
  ]);
  const chamadas: PedidoTemplate[] = [];
  await processarLembretesWhatsappCloud(repo, CONFIG, { ...silencioso, enviar: enviadorFixo({ resultado: "aceite", wamid: "x", http: 200 }, chamadas) });
  assertEquals(chamadas.length, 0);
  assertEquals(cancelados.map((c) => c[1]), ["profissional_nao_corresponde", "cliente_de_outra_agenda"]);
});

Deno.test("erro interno depois da reserva não provoca reenvio", async () => {
  const { repo } = repoFalso([{ id: "f1", preparado: prep() }]);
  repo.registarResultado = () => Promise.reject(new Error("db caiu"));
  const chamadas: PedidoTemplate[] = [];
  const c = await processarLembretesWhatsappCloud(repo, CONFIG, {
    ...silencioso,
    enviar: enviadorFixo({ resultado: "aceite", wamid: "wamid.1", http: 200 }, chamadas),
  });
  assertEquals([c.erros_internos, chamadas.length], [1, 1]);
});

Deno.test("logs não contêm o telefone completo", async () => {
  const linhasLog: string[] = [];
  const { repo } = repoFalso([{ id: "f1", preparado: prep() }]);
  await processarLembretesWhatsappCloud(repo, CONFIG, {
    log: (m) => linhasLog.push(m),
    enviar: enviadorFixo({ resultado: "incerto", codigo: "timeout", detalhe: "" }),
  });
  assert(linhasLog.length > 0);
  assert(linhasLog.every((l) => !l.includes("912345678")));
});
