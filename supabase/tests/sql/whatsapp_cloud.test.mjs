// Testes das funções SQL da WhatsApp Cloud API contra um Postgres 17 LOCAL e
// descartável (embedded-postgres). Nunca se liga ao Supabase.
//
//   cd supabase/tests/sql && npm install && npm test

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "../../..");
const PORTA = 54329;
const dataDir = path.join(os.tmpdir(), `esteticalchub-pg-${process.pid}`);

let servidor;
const ligacoes = [];
async function ligar() {
  const c = new pg.Client({ host: "localhost", port: PORTA, user: "postgres", password: "postgres", database: "teste" });
  await c.connect();
  ligacoes.push(c);
  return c;
}
let db;

// Datas fixas: marcação a 10/03/2030 às 15:00 (Lisboa); "agora" = véspera às 15:01.
const DATA = "2030-03-10";
const HORA = "15:00";
const AGORA_OK = "2030-03-09 15:01:00 Europe/Lisbon";

before(async () => {
  await rm(dataDir, { recursive: true, force: true });
  servidor = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PORTA, persistent: false, onLog: () => {} });
  await servidor.initialise();
  await servidor.start();
  await servidor.createDatabase("teste");
  db = await ligar();
  await db.query(await readFile(path.join(aqui, "bootstrap.sql"), "utf8"));
  // Migrations reais do repositório, pela ordem em que existem em produção:
  await db.query(await readFile(path.join(raiz, "supabase_migration_fila_notificacoes_envio.sql"), "utf8"));
  await db.query(await readFile(path.join(raiz, "supabase_migration_fila_tipo_confirmacao.sql"), "utf8"));
  // A migration nova, exatamente como será aplicada:
  await db.query(await readFile(path.join(raiz, "supabase_migration_whatsapp_cloud.sql"), "utf8"));
});

after(async () => {
  for (const c of ligacoes) await c.end().catch(() => {});
  await servidor?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.query(`truncate public.whatsapp_cloud_eventos, public.whatsapp_cloud_envios, public.fila_notificacoes,
    public.agendamentos, public.clientes, public.paginas_publicas, public.whatsapp_cloud_profissionais, auth.users cascade`);
});

// ---------------------------------------------------------------------------
// Ajudantes
// ---------------------------------------------------------------------------

async function criarProfissional({ adesao = true, limite = 20, nome = "Estúdio Exemplo" } = {}) {
  const { rows: [u] } = await db.query(`insert into auth.users (raw_user_meta_data) values ($1) returning id`, [{ full_name: "Profissional" }]);
  const agenda = (await db.query(`select gen_random_uuid() id`)).rows[0].id;
  if (nome) await db.query(`insert into paginas_publicas (usuario_id, slug, nome_negocio) values ($1, $2, $3)`, [u.id, `s-${u.id}`, nome]);
  if (adesao !== null) await db.query(`insert into whatsapp_cloud_profissionais (usuario_id, ativo, limite_diario) values ($1, $2, $3)`, [u.id, adesao, limite]);
  return { usuario: u.id, agenda };
}

async function criarMarcacao(p, { consentimento = true, telefone = "912345678", data = DATA, hora = HORA, agendaCliente, canal = "whatsapp", aceita = true } = {}) {
  const { rows: [c] } = await db.query(
    `insert into clientes (usuario_id, nome, telefone, agenda_id, aceita_lembretes, whatsapp_consentimento_em, whatsapp_consentimento_origem)
     values ($1, 'Ana Maria', $2, $3, $4, $5, $6) returning id`,
    [p.usuario, telefone, agendaCliente ?? p.agenda, aceita, consentimento ? new Date() : null, consentimento ? "teste" : null],
  );
  const { rows: [a] } = await db.query(
    `insert into agendamentos (data, hora, cliente, procedimento, usuario_id, cliente_id, canal_notificacao, agenda_id)
     values ($1, $2, 'Ana Maria', 'Microblading', $3, $4, $5, $6) returning id`,
    [data, hora, p.usuario, c.id, canal, p.agenda],
  );
  return { cliente: c.id, agendamento: a.id };
}

async function inserirFila(p, agendamento, { canal = "whatsapp", antecedencia = "1_dia", destino = "999999999", mensagem = "texto da fila", disparo = "2000-01-01" } = {}) {
  const { rows: [f] } = await db.query(
    `insert into fila_notificacoes (agendamento_id, usuario_id, tipo_destino, canal, antecedencia, data_disparo, destino, mensagem)
     values ($1, $2, 'cliente', $3, $4, $5, $6, $7) returning id, canal`,
    [agendamento, p.usuario, canal, antecedencia, disparo, destino, mensagem],
  );
  return f;
}

const reivindicarCloud = (c = db, limite = 50) =>
  c.query(`select id, canal from reivindicar_whatsapp_cloud($1, 3)`, [limite]).then((r) => r.rows);
const reivindicarAntigo = (c = db, canal = "whatsapp") =>
  c.query(`select id, canal from reivindicar_notificacoes(50, $1)`, [canal]).then((r) => r.rows);
const preparar = (fila, agora = AGORA_OK) =>
  db.query(`select whatsapp_cloud_preparar($1, $2::timestamptz) r`, [fila, agora]).then((r) => r.rows[0].r);

async function reservar(c, filaId, ag, p, chave = "chave-1") {
  const { rows: [r] } = await c.query(
    `select whatsapp_cloud_reservar($1, $2, $3, $4, 'lembrete', '1_dia', '2030-03-10T15:00', '+351******678', 'lembrete_marcacao_24h', 'pt_PT') r`,
    [filaId, chave, ag, p.usuario],
  );
  return r.r;
}
const registar = (envio, fila, resultado, { wamid = null, retentavel = null, codigo = null, atraso = 600 } = {}) =>
  db.query(`select whatsapp_cloud_registar_resultado($1, $2, $3, $4, $5, $6, 'detalhe', $7, 3) r`, [envio, fila, resultado, wamid, retentavel, codigo, atraso])
    .then((r) => r.rows[0].r);
const filaStatus = (id) => db.query(`select status, ultimo_erro, canal from fila_notificacoes where id=$1`, [id]).then((r) => r.rows[0]);
const envio = (id) => db.query(`select * from whatsapp_cloud_envios where id=$1`, [id]).then((r) => r.rows[0]);

// ---------------------------------------------------------------------------
// 1. Separação de fornecedores (correção obrigatória 1)
// ---------------------------------------------------------------------------

describe("separação Baileys / Cloud API", () => {
  test("trigger: só lembretes de 1 dia de profissionais aderentes passam a whatsapp_cloud", async () => {
    const aderente = await criarProfissional();
    const naoAderente = await criarProfissional({ adesao: null });
    const inativa = await criarProfissional({ adesao: false });
    const m1 = await criarMarcacao(aderente);
    const m2 = await criarMarcacao(naoAderente);
    const m3 = await criarMarcacao(inativa);

    assert.equal((await inserirFila(aderente, m1.agendamento)).canal, "whatsapp_cloud");
    assert.equal((await inserirFila(aderente, m1.agendamento, { antecedencia: "1_hora" })).canal, "whatsapp");
    assert.equal((await inserirFila(aderente, m1.agendamento, { canal: "email" })).canal, "email");
    assert.equal((await inserirFila(naoAderente, m2.agendamento)).canal, "whatsapp");
    assert.equal((await inserirFila(inativa, m3.agendamento)).canal, "whatsapp");
  });

  test("12. reivindicar_notificacoes (cron atual) NUNCA devolve linhas whatsapp_cloud, e vice-versa", async () => {
    const aderente = await criarProfissional();
    const outra = await criarProfissional({ adesao: null });
    const m1 = await criarMarcacao(aderente);
    const m2 = await criarMarcacao(outra);
    const cloud = await inserirFila(aderente, m1.agendamento);
    const baileys = await inserirFila(outra, m2.agendamento);

    const antigo = await reivindicarAntigo();
    assert.deepEqual(antigo.map((r) => r.id), [baileys.id]);
    const novo = await reivindicarCloud();
    assert.deepEqual(novo.map((r) => r.id), [cloud.id]);
  });

  test("12. reivindicações simultâneas (10 ligações) nunca entregam a mesma linha duas vezes", async () => {
    const p = await criarProfissional();
    const ids = [];
    for (let i = 0; i < 30; i++) {
      const m = await criarMarcacao(p);
      ids.push((await inserirFila(p, m.agendamento)).id);
    }
    const clientes = await Promise.all(Array.from({ length: 10 }, () => ligar()));
    const resultados = await Promise.all(clientes.map((c) => reivindicarCloud(c, 5)));
    const todos = resultados.flat().map((r) => r.id);
    assert.equal(new Set(todos).size, todos.length, "nenhuma linha repetida");
    assert.deepEqual([...todos].sort(), [...ids].sort());
  });

  test("12. transação aberta do cron antigo + worker novo em paralelo: conjuntos disjuntos", async () => {
    const aderente = await criarProfissional();
    const outra = await criarProfissional({ adesao: null });
    const cloud = await inserirFila(aderente, (await criarMarcacao(aderente)).agendamento);
    const baileys = await inserirFila(outra, (await criarMarcacao(outra)).agendamento);
    const a = await ligar();
    const b = await ligar();
    await a.query("begin");
    const doAntigo = await reivindicarAntigo(a);       // trancas abertas
    const doNovo = await reivindicarCloud(b);          // corre enquanto A não fez commit
    await a.query("commit");
    assert.deepEqual(doAntigo.map((r) => r.id), [baileys.id]);
    assert.deepEqual(doNovo.map((r) => r.id), [cloud.id]);
  });

  test("a profissional (role authenticated) não pode mudar uma linha de fornecedor nem mexer em linhas da Cloud API", async () => {
    const p = await criarProfissional();
    const m = await criarMarcacao(p);
    const cloud = await inserirFila(p, m.agendamento);
    const c = await ligar();
    await c.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false)`, [p.usuario]);
    await c.query(`set role authenticated`);
    await assert.rejects(c.query(`update fila_notificacoes set status='pendente', destino='+351900000000' where id=$1`, [cloud.id]), /só podem ser alteradas pelo servidor/);
    const outra = await inserirFila(p, m.agendamento, { antecedencia: "1_hora" });
    await assert.rejects(c.query(`update fila_notificacoes set canal='whatsapp_cloud' where id=$1`, [outra.id]), /só podem ser alteradas pelo servidor/);
    // apagar continua permitido (é o que a edição de marcações faz)
    const del = await c.query(`delete from fila_notificacoes where id=$1`, [cloud.id]);
    assert.equal(del.rowCount, 1);
    // e não pode chamar as funções de servidor
    await assert.rejects(c.query(`select * from reivindicar_whatsapp_cloud(10, 3)`), /permission denied/);
    await c.query("reset role");
  });

  test("rollback: devolver_ao_baileys só devolve linhas ainda não tratadas", async () => {
    const p = await criarProfissional();
    const f1 = await inserirFila(p, (await criarMarcacao(p)).agendamento);
    const f2 = await inserirFila(p, (await criarMarcacao(p)).agendamento);
    await reivindicarCloud(db, 1); // f1 fica 'processando'
    const n = (await db.query(`select whatsapp_cloud_devolver_ao_baileys(null) n`)).rows[0].n;
    assert.equal(n, 1);
    assert.equal((await filaStatus(f2.id)).canal, "whatsapp");
    assert.equal((await filaStatus(f1.id)).canal, "whatsapp_cloud");
  });
});

// ---------------------------------------------------------------------------
// 3. Validação na base de dados (correção obrigatória 3)
// ---------------------------------------------------------------------------

describe("whatsapp_cloud_preparar: valida tudo nas tabelas, ignora destino/mensagem da fila", () => {
  async function linhaReservada(opcoes = {}, prof = {}) {
    const p = await criarProfissional(prof);
    const m = await criarMarcacao(p, opcoes);
    const f = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    return { p, m, f };
  }

  test("caso válido devolve telefone da ficha da cliente (não o destino da fila)", async () => {
    const { f } = await linhaReservada();
    const r = await preparar(f.id);
    assert.equal(r.ok, true);
    assert.equal(r.telefone, "912345678");
    assert.equal(r.profissional_nome, "Estúdio Exemplo");
    assert.equal(r.versao_marcacao, "2030-03-10T15:00");
    assert.equal(JSON.stringify(r).includes("999999999"), false);
    assert.equal(JSON.stringify(r).includes("texto da fila"), false);
  });

  test("sem consentimento WhatsApp => recusado", async () => {
    const { f } = await linhaReservada({ consentimento: false });
    assert.equal((await preparar(f.id)).motivo, "sem_consentimento_whatsapp");
  });

  test("opt-out => recusado", async () => {
    const { f } = await linhaReservada({ aceita: false });
    assert.equal((await preparar(f.id)).motivo, "cliente_com_opt_out");
  });

  test("14. cliente de outra agenda => recusado (isolamento)", async () => {
    const { f } = await linhaReservada({ agendaCliente: "00000000-0000-4000-8000-000000000001" });
    assert.equal((await preparar(f.id)).motivo, "cliente_de_outra_agenda");
  });

  test("14. linha da fila com usuario_id de outra profissional => recusado", async () => {
    const dona = await criarProfissional();
    const intrusa = await criarProfissional();
    const m = await criarMarcacao(dona);
    const f = await inserirFila(intrusa, m.agendamento); // a intrusa aponta para a marcação de outra
    await reivindicarCloud();
    assert.equal((await preparar(f.id)).motivo, "profissional_nao_corresponde");
  });

  test("adesão desativada depois de criada a linha => recusado", async () => {
    const { p, f } = await linhaReservada();
    await db.query(`update whatsapp_cloud_profissionais set ativo=false where usuario_id=$1`, [p.usuario]);
    assert.equal((await preparar(f.id)).motivo, "profissional_sem_adesao");
  });

  test("marcação mudada para email / lembrete desligado / cancelada / falta", async () => {
    const casos = [
      ["canal_notificacao='email'", "canal_da_marcacao_nao_e_whatsapp"],
      ["lembrete_1dia=false", "lembrete_desligado"],
      ["status_confirmacao='cancelado'", "marcacao_cancelada"],
      ["faltou=true", "marcacao_com_falta"],
    ];
    for (const [set, motivo] of casos) {
      await db.query(`truncate whatsapp_cloud_envios, fila_notificacoes, agendamentos, clientes, paginas_publicas, whatsapp_cloud_profissionais, auth.users cascade`);
      const { m, f } = await linhaReservada();
      await db.query(`update agendamentos set ${set} where id=$1`, [m.agendamento]);
      assert.equal((await preparar(f.id)).motivo, motivo, set);
    }
  });

  test("janela temporal: cedo demais, no próprio dia, depois da hora", async () => {
    const { f } = await linhaReservada();
    assert.equal((await preparar(f.id, "2030-03-09 14:30:00 Europe/Lisbon")).motivo, "cedo_demais");
    assert.equal((await preparar(f.id, "2030-03-09 14:50:00 Europe/Lisbon")).ok, true); // 10 min de tolerância
    assert.equal((await preparar(f.id, "2030-03-10 09:00:00 Europe/Lisbon")).motivo, "fora_da_janela_de_amanha");
    assert.equal((await preparar(f.id, "2030-03-10 16:00:00 Europe/Lisbon")).motivo, "fora_da_janela_de_amanha");
  });

  test("sem nome de profissional => recusado (a mensagem tem de identificar quem lembra)", async () => {
    const p = await criarProfissional({ nome: null });
    await db.query(`update auth.users set raw_user_meta_data='{}' where id=$1`, [p.usuario]);
    const m = await criarMarcacao(p);
    const f = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    assert.equal((await preparar(f.id)).motivo, "sem_nome_profissional");
  });

  test("limite diário por profissional", async () => {
    const { p, m, f } = await linhaReservada({}, { limite: 1 });
    await db.query(
      `insert into whatsapp_cloud_envios (usuario_id, agendamento_id, tipo, antecedencia, versao_marcacao, chave_idempotencia, telefone_mascarado, template, idioma, estado, criado_em)
       values ($1, $2, 'lembrete', '1_dia', 'x', 'outra', '+351***', 't', 'pt_PT', 'aceite', '2030-03-09 10:00 Europe/Lisbon')`,
      [p.usuario, m.agendamento],
    );
    assert.equal((await preparar(f.id)).motivo, "limite_diario_da_profissional");
  });

  test("linha não reservada ou de 1 hora => recusado", async () => {
    const p = await criarProfissional();
    const m = await criarMarcacao(p);
    const f = await inserirFila(p, m.agendamento);
    assert.equal((await preparar(f.id)).motivo, "fila_nao_reservada");
  });
});

// ---------------------------------------------------------------------------
// 2/4. Idempotência e resultados (correções obrigatórias 2 e 4)
// ---------------------------------------------------------------------------

describe("idempotência e resultados", () => {
  async function base() {
    const p = await criarProfissional();
    const m = await criarMarcacao(p);
    const f = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    return { p, m, f };
  }

  test("mesma chave duas vezes => só a primeira reserva avança", async () => {
    const { p, m, f } = await base();
    const r1 = await reservar(db, f.id, m.agendamento, p);
    const r2 = await reservar(db, f.id, m.agendamento, p);
    assert.equal(r1.reservado, true);
    assert.deepEqual(r2, { reservado: false, estado_existente: "reservado" });
  });

  test("12. reservas simultâneas da mesma chave em 2 ligações => exatamente 1 vence", async () => {
    const { p, m, f } = await base();
    const a = await ligar();
    const b = await ligar();
    await a.query("begin");
    const ra = await reservar(a, f.id, m.agendamento, p, "chave-concorrente");
    const promessaB = reservar(b, f.id, m.agendamento, p, "chave-concorrente"); // bloqueia no índice único
    await new Promise((r) => setTimeout(r, 200));
    await a.query("commit");
    const rb = await promessaB;
    assert.equal(ra.reservado, true);
    assert.equal(rb.reservado, false);
  });

  test("fila recriada por edição (nova linha, MESMA versão) após aceite => duplicado bloqueado", async () => {
    const { p, m, f } = await base();
    const r = await reservar(db, f.id, m.agendamento, p);
    await registar(r.envio_id, f.id, "aceite", { wamid: "wamid.1" });
    const nova = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    const r2 = await reservar(db, nova.id, m.agendamento, p);
    assert.deepEqual(r2, { reservado: false, estado_existente: "aceite" });
  });

  test("remarcação (nova versão => nova chave) => novo lembrete permitido", async () => {
    const { p, m, f } = await base();
    const r = await reservar(db, f.id, m.agendamento, p, "chave-v1");
    await registar(r.envio_id, f.id, "aceite", { wamid: "wamid.v1" });
    const nova = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    assert.equal((await reservar(db, nova.id, m.agendamento, p, "chave-v2")).reservado, true);
  });

  test("4. resultado INCERTO => desconhecido, fila 'falhou', NUNCA volta a ser reivindicada", async () => {
    const { p, m, f } = await base();
    const r = await reservar(db, f.id, m.agendamento, p);
    assert.equal(await registar(r.envio_id, f.id, "incerto", { codigo: "timeout" }), "desconhecido");
    assert.equal((await envio(r.envio_id)).estado, "desconhecido");
    assert.equal((await filaStatus(f.id)).status, "falhou");
    assert.deepEqual(await reivindicarCloud(), []);
    // e uma linha recriada com a mesma versão também não reenvia
    const nova = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    assert.deepEqual(await reservar(db, nova.id, m.agendamento, p), { reservado: false, estado_existente: "desconhecido" });
  });

  test("4. rejeição TEMPORÁRIA confirmada => nova tentativa só depois do atraso", async () => {
    const { p, m, f } = await base();
    const r = await reservar(db, f.id, m.agendamento, p);
    assert.equal(await registar(r.envio_id, f.id, "rejeitado", { retentavel: true, codigo: "meta_130429", atraso: 3600 }), "nova_tentativa_agendada");
    assert.equal((await filaStatus(f.id)).status, "erro");
    assert.deepEqual(await reivindicarCloud(), [], "ainda dentro do atraso");
    await db.query(`update whatsapp_cloud_envios set proxima_tentativa_em = now() - interval '1 second' where id=$1`, [r.envio_id]);
    assert.equal((await reivindicarCloud()).length, 1);
    const r2 = await reservar(db, f.id, m.agendamento, p);
    assert.equal(r2.reservado, true);
    assert.equal((await envio(r2.envio_id)).tentativas, 2);
  });

  test("4. rejeição DEFINITIVA => falhado, sem nova tentativa", async () => {
    const { p, m, f } = await base();
    const r = await reservar(db, f.id, m.agendamento, p);
    assert.equal(await registar(r.envio_id, f.id, "rejeitado", { retentavel: false, codigo: "meta_132001" }), "falhado");
    assert.equal((await filaStatus(f.id)).status, "falhou");
    assert.deepEqual(await reivindicarCloud(), []);
  });

  test("rejeição temporária no limite de tentativas => falhado", async () => {
    const { p, m, f } = await base();
    await db.query(`update fila_notificacoes set tentativas=3 where id=$1`, [f.id]);
    const r = await reservar(db, f.id, m.agendamento, p);
    assert.equal(await registar(r.envio_id, f.id, "rejeitado", { retentavel: true, codigo: "http_429" }), "falhado");
  });

  test("reserva órfã (worker caiu) expira para 'desconhecido' e não é repetida", async () => {
    const { p, m, f } = await base();
    const r = await reservar(db, f.id, m.agendamento, p);
    await db.query(`update whatsapp_cloud_envios set reservado_em = now() - interval '11 minutes' where id=$1`, [r.envio_id]);
    assert.equal((await db.query(`select whatsapp_cloud_expirar_reservas(10) n`)).rows[0].n, 1);
    assert.equal((await envio(r.envio_id)).estado, "desconhecido");
    assert.equal((await filaStatus(f.id)).status, "falhou");
  });
});

// ---------------------------------------------------------------------------
// Webhook (11 e 13)
// ---------------------------------------------------------------------------

describe("eventos do webhook", () => {
  async function aceite(wamid = "wamid.W") {
    const p = await criarProfissional();
    const m = await criarMarcacao(p);
    const f = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    const r = await reservar(db, f.id, m.agendamento, p);
    await registar(r.envio_id, f.id, "aceite", { wamid });
    return { f, envioId: r.envio_id };
  }
  const evento = (wamid, estado, codigo = null) =>
    db.query(`select whatsapp_cloud_registar_evento($1, $2, now(), $3) r`, [wamid, estado, codigo]).then((r) => r.rows[0].r);

  test("11. evento repetido não duplica registos", async () => {
    await aceite();
    assert.equal(await evento("wamid.W", "entregue"), "aplicado");
    assert.equal(await evento("wamid.W", "entregue"), "repetido");
    assert.equal((await db.query(`select count(*)::int n from whatsapp_cloud_eventos`)).rows[0].n, 1);
  });

  test("estados nunca retrocedem (lido antes de entregue)", async () => {
    const { envioId } = await aceite();
    await evento("wamid.W", "lido");
    await evento("wamid.W", "entregue");
    const e = await envio(envioId);
    assert.equal(e.estado, "lido");
    assert.ok(e.entregue_em && e.lido_em);
  });

  test("13. falha depois de aceite => envio falhado e fila 'falhou'", async () => {
    const { f, envioId } = await aceite();
    await evento("wamid.W", "enviado");
    await evento("wamid.W", "falhado", "131026");
    assert.equal((await envio(envioId)).estado, "falhado");
    assert.equal((await envio(envioId)).erro_codigo, "131026");
    assert.equal((await filaStatus(f.id)).status, "falhou");
  });

  test("falha não sobrepõe uma entrega já confirmada", async () => {
    const { envioId } = await aceite();
    await evento("wamid.W", "entregue");
    await evento("wamid.W", "falhado", "1");
    assert.equal((await envio(envioId)).estado, "entregue");
  });

  test("webhook que chega ANTES do registo do wamid é reaplicado ao registar", async () => {
    const p = await criarProfissional();
    const m = await criarMarcacao(p);
    const f = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    const r = await reservar(db, f.id, m.agendamento, p);
    assert.equal(await evento("wamid.CEDO", "entregue"), "guardado_sem_envio");
    await registar(r.envio_id, f.id, "aceite", { wamid: "wamid.CEDO" });
    assert.equal((await envio(r.envio_id)).estado, "entregue");
  });
});

describe("migration", () => {
  test("pode ser aplicada uma segunda vez sem erros (idempotente)", async () => {
    await db.query(await readFile(path.join(raiz, "supabase_migration_whatsapp_cloud.sql"), "utf8"));
  });

  test("sem adesões, o comportamento da fila é exatamente o atual", async () => {
    const p = await criarProfissional({ adesao: null });
    const m = await criarMarcacao(p);
    const f = await inserirFila(p, m.agendamento);
    assert.equal(f.canal, "whatsapp");
    assert.deepEqual((await reivindicarAntigo()).map((r) => r.id), [f.id]);
  });
});
