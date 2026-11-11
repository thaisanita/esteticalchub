// Testes das funções SQL da WhatsApp Cloud API contra um Postgres 17 LOCAL e
// descartável (embedded-postgres). Nunca se liga ao Supabase.
//
//   cd supabase/tests/sql && npm install && npm test

import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
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
const NUMERO = "1376229915563846";
const TEXTO = "v1-2026-11";

let servidor;
let db;
const ligacoes = [];
async function ligar() {
  const c = new pg.Client({ host: "localhost", port: PORTA, user: "postgres", password: "postgres", database: "teste" });
  await c.connect();
  ligacoes.push(c);
  return c;
}

// Marcação a 10/03/2030 às 15:00 (Lisboa); "agora" = véspera às 15:01.
const DATA = "2030-03-10";
const HORA = "15:00";
const AGORA_OK = "2030-03-09 15:01:00 Europe/Lisbon";
const h = (s) => createHash("sha256").update(s).digest("hex");

before(async () => {
  await rm(dataDir, { recursive: true, force: true });
  servidor = new EmbeddedPostgres({ databaseDir: dataDir, user: "postgres", password: "postgres", port: PORTA, persistent: false, onLog: () => {} });
  await servidor.initialise();
  await servidor.start();
  await servidor.createDatabase("teste");
  db = await ligar();
  await db.query(await readFile(path.join(aqui, "bootstrap.sql"), "utf8"));
  await db.query(await readFile(path.join(raiz, "supabase_migration_fila_notificacoes_envio.sql"), "utf8"));
  await db.query(await readFile(path.join(raiz, "supabase_migration_fila_tipo_confirmacao.sql"), "utf8"));
  await db.query(await readFile(path.join(raiz, "supabase_migration_whatsapp_cloud.sql"), "utf8"));
});

after(async () => {
  for (const c of ligacoes) await c.end().catch(() => {});
  await servidor?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.query(`truncate public.whatsapp_cloud_eventos, public.whatsapp_cloud_envios, public.whatsapp_cloud_consentimentos,
    public.whatsapp_cloud_bloqueios, public.fila_notificacoes, public.agendamentos, public.clientes, public.paginas_publicas,
    public.whatsapp_cloud_profissionais, public.whatsapp_cloud_numeros, auth.users cascade`);
  await db.query(`update whatsapp_cloud_execucoes set bloqueado_ate='-infinity', dono=null`);
  await db.query(`update whatsapp_cloud_textos_consentimento set valido=true`);
  await db.query(`insert into whatsapp_cloud_numeros (phone_number_id, ativo, limite_diario) values ($1, true, 200)`, [NUMERO]);
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
    `insert into clientes (usuario_id, nome, telefone, agenda_id, aceita_lembretes) values ($1, 'Ana Maria', $2, $3, $4) returning id`,
    [p.usuario, telefone, agendaCliente ?? p.agenda, aceita],
  );
  if (consentimento) {
    await db.query(
      `insert into whatsapp_cloud_consentimentos (cliente_id, usuario_id, origem, texto_versao, registado_por, concedido_em)
       values ($1, $2, 'presencial_registado', $3, $2, '2030-01-01')`,
      [c.id, p.usuario, TEXTO],
    );
  }
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

const reivindicarCloud = (c = db, limite = 50) => c.query(`select id, canal from reivindicar_whatsapp_cloud($1, 3)`, [limite]).then((r) => r.rows);
const reivindicarAntigo = (c = db, canal = "whatsapp") => c.query(`select id, canal from reivindicar_notificacoes(50, $1)`, [canal]).then((r) => r.rows);
const preparar = (fila, agora = AGORA_OK) => db.query(`select whatsapp_cloud_preparar($1, $2::timestamptz) r`, [fila, agora]).then((r) => r.rows[0].r);

async function reservar(c, filaId, ag, p, { chave = "chave-1", assinatura = "assin-1", tel = "+351912345678", numero = NUMERO } = {}) {
  const { rows: [r] } = await c.query(
    `select whatsapp_cloud_reservar($1, $2, $3, $4, $5, 'lembrete', '1_dia', '2030-03-10T15:00', $6, '+351******678', 'lembrete_marcacao_24h', 'pt_PT', $7) r`,
    [filaId, chave, assinatura, ag, p.usuario, h(tel), numero],
  );
  return r.r;
}
const registar = (envio, fila, resultado, { wamid = null, retentavel = null, codigo = null, atraso = 600 } = {}) =>
  db.query(`select whatsapp_cloud_registar_resultado($1, $2, $3, $4, $5, $6, 'detalhe', $7, 3) r`, [envio, fila, resultado, wamid, retentavel, codigo, atraso])
    .then((r) => r.rows[0].r);
const filaStatus = (id) => db.query(`select status, ultimo_erro, canal, tentativas from fila_notificacoes where id=$1`, [id]).then((r) => r.rows[0]);
const envio = (id) => db.query(`select * from whatsapp_cloud_envios where id=$1`, [id]).then((r) => r.rows[0]);
async function comoProfissional(usuario) {
  const c = await ligar();
  await c.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false)`, [usuario]);
  await c.query(`set role authenticated`);
  return c;
}

async function linhaReservada(opcoesMarcacao = {}, opcoesProf = {}) {
  const p = await criarProfissional(opcoesProf);
  const m = await criarMarcacao(p, opcoesMarcacao);
  const f = await inserirFila(p, m.agendamento);
  await reivindicarCloud();
  return { p, m, f };
}

// ---------------------------------------------------------------------------
// Separação Baileys / Cloud API
// ---------------------------------------------------------------------------

describe("separação Baileys / Cloud API", () => {
  test("trigger: só lembretes de 1 dia de profissionais aderentes passam a whatsapp_cloud", async () => {
    const aderente = await criarProfissional();
    const naoAderente = await criarProfissional({ adesao: null });
    const inativa = await criarProfissional({ adesao: false });
    const m1 = await criarMarcacao(aderente);
    assert.equal((await inserirFila(aderente, m1.agendamento)).canal, "whatsapp_cloud");
    assert.equal((await inserirFila(aderente, m1.agendamento, { antecedencia: "1_hora" })).canal, "whatsapp");
    assert.equal((await inserirFila(aderente, m1.agendamento, { canal: "email" })).canal, "email");
    assert.equal((await inserirFila(naoAderente, (await criarMarcacao(naoAderente)).agendamento)).canal, "whatsapp");
    assert.equal((await inserirFila(inativa, (await criarMarcacao(inativa)).agendamento)).canal, "whatsapp");
  });

  test("12. reivindicar_notificacoes (cron atual) NUNCA devolve linhas whatsapp_cloud, e vice-versa", async () => {
    const aderente = await criarProfissional();
    const outra = await criarProfissional({ adesao: null });
    const cloud = await inserirFila(aderente, (await criarMarcacao(aderente)).agendamento);
    const baileys = await inserirFila(outra, (await criarMarcacao(outra)).agendamento);
    assert.deepEqual((await reivindicarAntigo()).map((r) => r.id), [baileys.id]);
    assert.deepEqual((await reivindicarCloud()).map((r) => r.id), [cloud.id]);
  });

  test("12. reivindicações simultâneas (10 ligações) nunca entregam a mesma linha duas vezes", async () => {
    const p = await criarProfissional();
    const ids = [];
    for (let i = 0; i < 30; i++) ids.push((await inserirFila(p, (await criarMarcacao(p)).agendamento)).id);
    const clientes = await Promise.all(Array.from({ length: 10 }, () => ligar()));
    const todos = (await Promise.all(clientes.map((c) => reivindicarCloud(c, 5)))).flat().map((r) => r.id);
    assert.equal(new Set(todos).size, todos.length);
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
    const doAntigo = await reivindicarAntigo(a);
    const doNovo = await reivindicarCloud(b);
    await a.query("commit");
    assert.deepEqual(doAntigo.map((r) => r.id), [baileys.id]);
    assert.deepEqual(doNovo.map((r) => r.id), [cloud.id]);
  });

  test("a profissional (authenticated) não muda fornecedores, não chama funções de servidor, não escreve consentimentos diretamente", async () => {
    const p = await criarProfissional();
    const m = await criarMarcacao(p);
    const cloud = await inserirFila(p, m.agendamento);
    const c = await comoProfissional(p.usuario);
    await assert.rejects(c.query(`update fila_notificacoes set status='pendente', destino='+351900000000' where id=$1`, [cloud.id]), /só podem ser alteradas pelo servidor/);
    const outra = await inserirFila(p, m.agendamento, { antecedencia: "1_hora" });
    await assert.rejects(c.query(`update fila_notificacoes set canal='whatsapp_cloud' where id=$1`, [outra.id]), /só podem ser alteradas pelo servidor/);
    assert.equal((await c.query(`delete from fila_notificacoes where id=$1`, [cloud.id])).rowCount, 1);
    await assert.rejects(c.query(`select * from reivindicar_whatsapp_cloud(10, 3)`), /permission denied/);
    await assert.rejects(c.query(`select whatsapp_cloud_registar_optout($1, 'PARAR', 'w')`, [h("x")]), /permission denied/);
    await assert.rejects(
      c.query(`insert into whatsapp_cloud_consentimentos (cliente_id, usuario_id, origem, texto_versao) values ($1, $2, 'presencial_registado', $3)`, [m.cliente, p.usuario, TEXTO]),
      /permission denied|row-level security/,
    );
  });

  test("rollback: devolver_ao_baileys só devolve linhas ainda não tratadas", async () => {
    const p = await criarProfissional();
    const f1 = await inserirFila(p, (await criarMarcacao(p)).agendamento);
    const f2 = await inserirFila(p, (await criarMarcacao(p)).agendamento);
    await reivindicarCloud(db, 1);
    assert.equal((await db.query(`select whatsapp_cloud_devolver_ao_baileys(null) n`)).rows[0].n, 1);
    assert.equal((await filaStatus(f2.id)).canal, "whatsapp");
    assert.equal((await filaStatus(f1.id)).canal, "whatsapp_cloud");
  });
});

// ---------------------------------------------------------------------------
// 3. Validação + consentimento explícito
// ---------------------------------------------------------------------------

describe("preparar: estado atual da marcação e consentimento comprovável", () => {
  test("caso válido: telefone da ficha (não da fila)", async () => {
    const { f } = await linhaReservada();
    const r = await preparar(f.id);
    assert.equal(r.ok, true);
    assert.equal(r.telefone, "912345678");
    assert.equal(r.versao_marcacao, "2030-03-10T15:00");
    assert.equal(JSON.stringify(r).includes("999999999") || JSON.stringify(r).includes("texto da fila"), false);
    assert.ok(r.consentimento_id);
  });

  test("3. aceita_lembretes=true SEM registo de consentimento => recusado", async () => {
    const { f } = await linhaReservada({ consentimento: false, aceita: true });
    assert.equal((await preparar(f.id)).motivo, "sem_consentimento_whatsapp");
  });

  test("3. consentimento revogado ou com texto invalidado => recusado", async () => {
    const { m, f } = await linhaReservada();
    await db.query(`update whatsapp_cloud_consentimentos set revogado_em=now() where cliente_id=$1`, [m.cliente]);
    assert.equal((await preparar(f.id)).motivo, "sem_consentimento_whatsapp");
    await db.query(`update whatsapp_cloud_consentimentos set revogado_em=null where cliente_id=$1`, [m.cliente]);
    await db.query(`update whatsapp_cloud_textos_consentimento set valido=false where versao=$1`, [TEXTO]);
    assert.equal((await preparar(f.id)).motivo, "sem_consentimento_whatsapp");
  });

  test("3. consentimento posterior ao momento do envio não conta", async () => {
    const { m, f } = await linhaReservada();
    await db.query(`update whatsapp_cloud_consentimentos set concedido_em='2030-03-09 20:00 Europe/Lisbon' where cliente_id=$1`, [m.cliente]);
    assert.equal((await preparar(f.id)).motivo, "sem_consentimento_whatsapp");
  });

  test("opt-out geral continua a prevalecer", async () => {
    const { f } = await linhaReservada({ aceita: false });
    assert.equal((await preparar(f.id)).motivo, "cliente_com_opt_out");
  });

  test("14. cliente de outra agenda / fila de outra profissional => recusado", async () => {
    const { f } = await linhaReservada({ agendaCliente: "00000000-0000-4000-8000-000000000001" });
    assert.equal((await preparar(f.id)).motivo, "cliente_de_outra_agenda");
    const dona = await criarProfissional();
    const intrusa = await criarProfissional();
    const m = await criarMarcacao(dona);
    const f2 = await inserirFila(intrusa, m.agendamento);
    await reivindicarCloud();
    assert.equal((await preparar(f2.id)).motivo, "profissional_nao_corresponde");
  });

  test("marcação alterada para email / lembrete desligado / cancelada / falta", async () => {
    for (const [set, motivo] of [
      ["canal_notificacao='email'", "canal_da_marcacao_nao_e_whatsapp"],
      ["lembrete_1dia=false", "lembrete_desligado"],
      ["status_confirmacao='cancelado'", "marcacao_cancelada"],
      ["faltou=true", "marcacao_com_falta"],
    ]) {
      const { m, f } = await linhaReservada();
      await db.query(`update agendamentos set ${set} where id=$1`, [m.agendamento]);
      assert.equal((await preparar(f.id)).motivo, motivo, set);
    }
  });

  test("4. remarcação para outro dia: a linha antiga deixa de ser elegível", async () => {
    const { m, f } = await linhaReservada();
    await db.query(`update agendamentos set data='2030-03-12' where id=$1`, [m.agendamento]);
    assert.ok(["cedo_demais", "fora_da_janela_de_amanha"].includes((await preparar(f.id)).motivo));
    await db.query(`update agendamentos set data='2030-03-08' where id=$1`, [m.agendamento]);
    assert.equal((await preparar(f.id)).motivo, "fora_da_janela_de_amanha");
  });

  test("janela temporal", async () => {
    const { f } = await linhaReservada();
    assert.equal((await preparar(f.id, "2030-03-09 14:30:00 Europe/Lisbon")).motivo, "cedo_demais");
    assert.equal((await preparar(f.id, "2030-03-09 14:50:00 Europe/Lisbon")).ok, true);
    assert.equal((await preparar(f.id, "2030-03-10 09:00:00 Europe/Lisbon")).motivo, "fora_da_janela_de_amanha");
  });

  test("adesão desativada depois de criada a linha => recusado", async () => {
    const { p, f } = await linhaReservada();
    await db.query(`update whatsapp_cloud_profissionais set ativo=false where usuario_id=$1`, [p.usuario]);
    assert.equal((await preparar(f.id)).motivo, "profissional_sem_adesao");
  });

  test("sem nome de profissional => recusado", async () => {
    const p = await criarProfissional({ nome: null });
    await db.query(`update auth.users set raw_user_meta_data='{}' where id=$1`, [p.usuario]);
    const f = await inserirFila(p, (await criarMarcacao(p)).agendamento);
    await reivindicarCloud();
    assert.equal((await preparar(f.id)).motivo, "sem_nome_profissional");
  });

  test("3. registar_consentimento_whatsapp: só clientes próprias, origens permitidas, texto válido, com prova", async () => {
    const p = await criarProfissional();
    const outra = await criarProfissional();
    const minha = await criarMarcacao(p, { consentimento: false });
    const alheia = await criarMarcacao(outra, { consentimento: false });
    const c = await comoProfissional(p.usuario);
    const { rows: [ok] } = await c.query(`select registar_consentimento_whatsapp($1, 'presencial_registado', $2) id`, [minha.cliente, TEXTO]);
    assert.ok(ok.id);
    await assert.rejects(c.query(`select registar_consentimento_whatsapp($1, 'presencial_registado', $2)`, [alheia.cliente, TEXTO]), /Cliente não encontrada/);
    await assert.rejects(c.query(`select registar_consentimento_whatsapp($1, 'formulario_publico', $2)`, [minha.cliente, TEXTO]), /Origem inválida/);
    await assert.rejects(c.query(`select registar_consentimento_whatsapp($1, 'presencial_registado', 'v0')`, [minha.cliente]), /Versão de texto inválida/);
    const { rows: [k] } = await db.query(`select registado_por, origem, texto_versao, concedido_em from whatsapp_cloud_consentimentos where id=$1`, [ok.id]);
    assert.deepEqual([k.registado_por, k.origem, k.texto_versao], [p.usuario, "presencial_registado", TEXTO]);
    assert.ok(k.concedido_em);
    await c.query(`select registar_consentimento_whatsapp($1, 'formulario_marcacao', $2)`, [minha.cliente, TEXTO]);
    assert.equal((await db.query(`select count(*)::int n from whatsapp_cloud_consentimentos where cliente_id=$1 and revogado_em is null`, [minha.cliente])).rows[0].n, 1);
    assert.equal((await db.query(`select count(*)::int n from whatsapp_cloud_consentimentos where cliente_id=$1`, [minha.cliente])).rows[0].n, 2, "o histórico fica guardado");
    assert.equal(await c.query(`select revogar_consentimento_whatsapp($1) r`, [alheia.cliente]).then((r) => r.rows[0].r), false);
  });
});

// ---------------------------------------------------------------------------
// 1. Limites atómicos
// ---------------------------------------------------------------------------

describe("1. limites diários atómicos", () => {
  async function filasDe(p, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const m = await criarMarcacao(p);
      const f = await inserirFila(p, m.agendamento);
      out.push({ p, m, f, chave: `k-${p.usuario}-${i}`, tel: `+3519123${String(10000 + i).slice(-5)}` });
    }
    await reivindicarCloud(db, 500);
    return out;
  }

  test("12. 12 reservas SIMULTÂNEAS com limite 3 por profissional => exatamente 3 passam", async () => {
    const p = await criarProfissional({ limite: 3 });
    const itens = await filasDe(p, 12);
    const clientes = await Promise.all(itens.map(() => ligar()));
    const res = await Promise.all(itens.map((it, i) => reservar(clientes[i], it.f.id, it.m.agendamento, p, { chave: it.chave, tel: it.tel })));
    assert.equal(res.filter((r) => r.reservado).length, 3);
    assert.ok(res.filter((r) => !r.reservado).every((r) => r.motivo === "limite_diario_profissional"));
  });

  test("12. limite por NÚMERO partilhado entre profissionais, com reservas simultâneas", async () => {
    await db.query(`update whatsapp_cloud_numeros set limite_diario=5 where phone_number_id=$1`, [NUMERO]);
    const a = await criarProfissional({ limite: 20 });
    const b = await criarProfissional({ limite: 20 });
    const itens = [...await filasDe(a, 6), ...await filasDe(b, 6)];
    const clientes = await Promise.all(itens.map(() => ligar()));
    const res = await Promise.all(itens.map((it, i) => reservar(clientes[i], it.f.id, it.m.agendamento, it.p, { chave: it.chave, tel: it.tel })));
    assert.equal(res.filter((r) => r.reservado).length, 5);
    assert.ok(res.filter((r) => !r.reservado).every((r) => r.motivo === "limite_diario_numero"));
  });

  test("14. isolamento: profissional A no limite não bloqueia a profissional B", async () => {
    const a = await criarProfissional({ limite: 1 });
    const b = await criarProfissional({ limite: 5 });
    const [a1, a2] = await filasDe(a, 2);
    const [b1] = await filasDe(b, 1);
    assert.equal((await reservar(db, a1.f.id, a1.m.agendamento, a, { chave: a1.chave })).reservado, true);
    assert.equal((await reservar(db, a2.f.id, a2.m.agendamento, a, { chave: a2.chave })).motivo, "limite_diario_profissional");
    assert.equal((await reservar(db, b1.f.id, b1.m.agendamento, b, { chave: b1.chave })).reservado, true);
  });

  test("envios cancelados não gastam limite; incertos gastam", async () => {
    const p = await criarProfissional({ limite: 1 });
    const [x, y, z] = await filasDe(p, 3);
    const r1 = await reservar(db, x.f.id, x.m.agendamento, p, { chave: x.chave });
    await db.query(`select whatsapp_cloud_libertar_reserva($1, $2, 'teste')`, [r1.envio_id, x.f.id]);
    const r2 = await reservar(db, y.f.id, y.m.agendamento, p, { chave: y.chave });
    assert.equal(r2.reservado, true);
    await registar(r2.envio_id, y.f.id, "incerto", { codigo: "timeout" });
    assert.equal((await reservar(db, z.f.id, z.m.agendamento, p, { chave: z.chave })).motivo, "limite_diario_profissional");
  });

  test("número inativo ou desconhecido => nada é reservado", async () => {
    const { p, m, f } = await linhaReservada();
    assert.equal((await reservar(db, f.id, m.agendamento, p, { numero: "999999" })).motivo, "numero_inativo");
    await db.query(`update whatsapp_cloud_numeros set ativo=false`);
    assert.equal((await reservar(db, f.id, m.agendamento, p)).motivo, "numero_inativo");
  });

  test("adiar: devolve a linha sem gastar tentativa e só volta depois do atraso", async () => {
    const { f } = await linhaReservada();
    const antes = (await filaStatus(f.id)).tentativas;
    await db.query(`select whatsapp_cloud_adiar($1, 30, 'limite_diario_numero')`, [f.id]);
    const depois = await filaStatus(f.id);
    assert.equal(depois.status, "pendente");
    assert.equal(depois.tentativas, antes - 1);
    assert.deepEqual(await reivindicarCloud(), []);
  });
});

// ---------------------------------------------------------------------------
// 2. Opt-out global
// ---------------------------------------------------------------------------

describe("2. opt-out global (PARAR)", () => {
  test("bloqueio impede novas reservas para o mesmo telefone, em QUALQUER profissional", async () => {
    const a = await linhaReservada();
    const { rows: [r] } = await db.query(`select whatsapp_cloud_registar_optout($1, 'PARAR', 'wamid.IN') r`, [h("+351912345678")]);
    assert.equal(r.r, "bloqueado");
    assert.equal((await reservar(db, a.f.id, a.m.agendamento, a.p)).motivo, "bloqueado_opt_out");
    const b = await linhaReservada();
    assert.equal((await reservar(db, b.f.id, b.m.agendamento, b.p, { chave: "outra" })).motivo, "bloqueado_opt_out");
  });

  test("PARAR repetido é idempotente", async () => {
    await db.query(`select whatsapp_cloud_registar_optout($1, 'PARAR', 'w1')`, [h("+351912345678")]);
    const { rows: [r] } = await db.query(`select whatsapp_cloud_registar_optout($1, 'STOP', 'w2') r`, [h("+351912345678")]);
    assert.equal(r.r, "repetido");
    assert.equal((await db.query(`select count(*)::int n from whatsapp_cloud_bloqueios`)).rows[0].n, 1);
  });

  test("PARAR recebido entre a reserva e o envio liberta a reserva (nada é enviado)", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p);
    await db.query(`select whatsapp_cloud_registar_optout($1, 'PARAR', 'w')`, [h("+351912345678")]);
    assert.equal((await envio(r.envio_id)).estado, "cancelado");
    assert.equal((await filaStatus(f.id)).status, "cancelado");
    const conf = (await db.query(`select whatsapp_cloud_confirmar_reserva($1, $2, $3) r`, [r.envio_id, f.id, h("+351912345678")])).rows[0].r;
    assert.equal(conf.ok, false);
  });

  test("nova tentativa pendente para um telefone bloqueado é cancelada", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p);
    await registar(r.envio_id, f.id, "rejeitado", { retentavel: true, codigo: "http_429" });
    await db.query(`select whatsapp_cloud_registar_optout($1, 'PARAR', 'w')`, [h("+351912345678")]);
    assert.equal((await envio(r.envio_id)).estado, "cancelado");
  });

  test("outros telefones não são afetados", async () => {
    const { p, m, f } = await linhaReservada();
    await db.query(`select whatsapp_cloud_registar_optout($1, 'PARAR', 'w')`, [h("+351900000000")]);
    assert.equal((await reservar(db, f.id, m.agendamento, p)).reservado, true);
  });
});

// ---------------------------------------------------------------------------
// 4. Idempotência, remarcações e resultados
// ---------------------------------------------------------------------------

describe("4. idempotência, remarcações e resultados", () => {
  test("12. reservas simultâneas da mesma chave em 2 ligações => exatamente 1 vence", async () => {
    const { p, m, f } = await linhaReservada();
    const a = await ligar();
    const b = await ligar();
    await a.query("begin");
    const ra = await reservar(a, f.id, m.agendamento, p, { chave: "concorrente" });
    const promessaB = reservar(b, f.id, m.agendamento, p, { chave: "concorrente" });
    await new Promise((r) => setTimeout(r, 200));
    await a.query("commit");
    const rb = await promessaB;
    assert.equal(ra.reservado, true);
    assert.equal(rb.reservado, false);
  });

  test("mesma DATA depois de aceite (fila recriada, ou só a hora/telefone mudou) => duplicado", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p, { chave: "dia-10", assinatura: "15h" });
    await registar(r.envio_id, f.id, "aceite", { wamid: "wamid.1" });
    const nova = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    const r2 = await reservar(db, nova.id, m.agendamento, p, { chave: "dia-10", assinatura: "16h" });
    assert.deepEqual(r2, { reservado: false, motivo: "duplicado", estado_existente: "aceite" });
  });

  test("alterações sucessivas A→B→A: voltar a uma data já lembrada não repete", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p, { chave: "dia-A" });
    await registar(r.envio_id, f.id, "aceite", { wamid: "wamid.A" });
    const fB = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    const rB = await reservar(db, fB.id, m.agendamento, p, { chave: "dia-B" });
    await registar(rB.envio_id, fB.id, "aceite", { wamid: "wamid.B" });
    const fA2 = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    assert.equal((await reservar(db, fA2.id, m.agendamento, p, { chave: "dia-A" })).motivo, "duplicado");
  });

  test("rejeição definitiva + dados corrigidos (assinatura diferente) => nova tentativa; mesmos dados => não", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p, { chave: "k", assinatura: "tel-errado" });
    await registar(r.envio_id, f.id, "rejeitado", { retentavel: false, codigo: "meta_131026" });
    const nova = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    assert.equal((await reservar(db, nova.id, m.agendamento, p, { chave: "k", assinatura: "tel-errado" })).motivo, "duplicado");
    assert.equal((await reservar(db, nova.id, m.agendamento, p, { chave: "k", assinatura: "tel-corrigido", tel: "+351934403569" })).reservado, true);
  });

  test("reserva cancelada (nada enviado) pode ser retomada", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p);
    await db.query(`select whatsapp_cloud_libertar_reserva($1, $2, 'marcacao_alterada')`, [r.envio_id, f.id]);
    const nova = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    assert.equal((await reservar(db, nova.id, m.agendamento, p)).reservado, true);
  });

  test("confirmar_reserva: linha apagada pela edição => reserva libertada; caso normal => ok", async () => {
    const a = await linhaReservada();
    const ra = await reservar(db, a.f.id, a.m.agendamento, a.p, { chave: "ka" });
    assert.deepEqual((await db.query(`select whatsapp_cloud_confirmar_reserva($1, $2, $3) r`, [ra.envio_id, a.f.id, h("+351912345678")])).rows[0].r, { ok: true });
    const b = await linhaReservada();
    const rb = await reservar(db, b.f.id, b.m.agendamento, b.p, { chave: "kb" });
    await db.query(`delete from fila_notificacoes where id=$1`, [b.f.id]);
    assert.deepEqual((await db.query(`select whatsapp_cloud_confirmar_reserva($1, $2, $3) r`, [rb.envio_id, b.f.id, h("+351912345678")])).rows[0].r, { ok: false, motivo: "fila_apagada" });
    assert.equal((await envio(rb.envio_id)).estado, "cancelado");
  });

  test("resultado INCERTO => desconhecido, nunca volta a ser reivindicado nem reservado", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p);
    assert.equal(await registar(r.envio_id, f.id, "incerto", { codigo: "timeout" }), "desconhecido");
    assert.equal((await filaStatus(f.id)).status, "falhou");
    assert.deepEqual(await reivindicarCloud(), []);
    const nova = await inserirFila(p, m.agendamento);
    await reivindicarCloud();
    assert.equal((await reservar(db, nova.id, m.agendamento, p, { assinatura: "outra" })).estado_existente, "desconhecido");
  });

  test("rejeição TEMPORÁRIA confirmada => nova tentativa só depois do atraso", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p);
    assert.equal(await registar(r.envio_id, f.id, "rejeitado", { retentavel: true, codigo: "meta_130429", atraso: 3600 }), "nova_tentativa_agendada");
    assert.deepEqual(await reivindicarCloud(), []);
    await db.query(`update whatsapp_cloud_envios set proxima_tentativa_em = now() - interval '1 second' where id=$1`, [r.envio_id]);
    assert.equal((await reivindicarCloud()).length, 1);
    const r2 = await reservar(db, f.id, m.agendamento, p);
    assert.equal((await envio(r2.envio_id)).tentativas, 2);
  });

  test("rejeição definitiva => falhado", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p);
    assert.equal(await registar(r.envio_id, f.id, "rejeitado", { retentavel: false, codigo: "meta_132001" }), "falhado");
    assert.equal((await filaStatus(f.id)).status, "falhou");
  });

  test("reserva órfã expira para 'desconhecido'", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p);
    await db.query(`update whatsapp_cloud_envios set reservado_em = now() - interval '11 minutes' where id=$1`, [r.envio_id]);
    assert.equal((await db.query(`select whatsapp_cloud_expirar_reservas(10) n`)).rows[0].n, 1);
    assert.equal((await envio(r.envio_id)).estado, "desconhecido");
    assert.equal((await filaStatus(f.id)).status, "falhou");
  });
});

// ---------------------------------------------------------------------------
// Webhook (estados)
// ---------------------------------------------------------------------------

describe("eventos do webhook", () => {
  async function aceite(wamid = "wamid.W") {
    const { p, m, f } = await linhaReservada();
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
  });

  test("estados nunca retrocedem", async () => {
    const { envioId } = await aceite();
    await evento("wamid.W", "lido");
    await evento("wamid.W", "entregue");
    assert.equal((await envio(envioId)).estado, "lido");
  });

  test("13. falha depois de aceite => envio falhado e fila 'falhou'", async () => {
    const { f, envioId } = await aceite();
    await evento("wamid.W", "enviado");
    await evento("wamid.W", "falhado", "131026");
    assert.equal((await envio(envioId)).estado, "falhado");
    assert.equal((await filaStatus(f.id)).status, "falhou");
  });

  test("webhook que chega antes do registo do wamid é reaplicado", async () => {
    const { p, m, f } = await linhaReservada();
    const r = await reservar(db, f.id, m.agendamento, p);
    assert.equal(await evento("wamid.CEDO", "entregue"), "guardado_sem_envio");
    await registar(r.envio_id, f.id, "aceite", { wamid: "wamid.CEDO" });
    assert.equal((await envio(r.envio_id)).estado, "entregue");
  });
});

// ---------------------------------------------------------------------------
// 6. Trinco de execução
// ---------------------------------------------------------------------------

describe("6. execução única do worker", () => {
  const adquirir = (c, dono, seg = 120) =>
    c.query(`select whatsapp_cloud_adquirir_execucao('processar-whatsapp-cloud', $1, $2) r`, [dono, seg]).then((r) => r.rows[0].r);

  test("12. 10 tentativas simultâneas => só 1 adquire", async () => {
    const clientes = await Promise.all(Array.from({ length: 10 }, () => ligar()));
    const res = await Promise.all(clientes.map((c) => adquirir(c, randomUUID())));
    assert.equal(res.filter(Boolean).length, 1);
  });

  test("libertar só pelo dono; prazo expirado liberta automaticamente", async () => {
    const a = randomUUID();
    assert.equal(await adquirir(db, a), true);
    await db.query(`select whatsapp_cloud_libertar_execucao('processar-whatsapp-cloud', $1)`, [randomUUID()]);
    assert.equal(await adquirir(db, randomUUID()), false);
    await db.query(`select whatsapp_cloud_libertar_execucao('processar-whatsapp-cloud', $1)`, [a]);
    assert.equal(await adquirir(db, randomUUID(), 0), true);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(await adquirir(db, randomUUID()), true);
  });
});

// ---------------------------------------------------------------------------
// 5. RGPD
// ---------------------------------------------------------------------------

describe("5. RGPD", () => {
  test("14. exportação devolve só os dados da própria profissional, sem hashes", async () => {
    const a = await linhaReservada();
    const b = await linhaReservada();
    await reservar(db, a.f.id, a.m.agendamento, a.p, { chave: "ka" });
    await reservar(db, b.f.id, b.m.agendamento, b.p, { chave: "kb" });
    const c = await comoProfissional(a.p.usuario);
    const { rows: [r] } = await c.query(`select whatsapp_cloud_exportar_meus_dados() d`);
    assert.equal(r.d.envios.length, 1);
    assert.equal(r.d.envios[0].usuario_id, a.p.usuario);
    assert.equal(r.d.consentimentos.length, 1);
    assert.equal(r.d.adesao.usuario_id, a.p.usuario);
    assert.equal(JSON.stringify(r.d).includes("telefone_hash"), false);
    assert.equal((await c.query(`select count(*)::int n from whatsapp_cloud_envios`)).rows[0].n, 1);
    assert.equal((await c.query(`select count(*)::int n from whatsapp_cloud_bloqueios`)).rows[0].n, 0);
  });

  test("eliminar a conta (auth.users) apaga envios, consentimentos e adesão; mantém bloqueios", async () => {
    const a = await linhaReservada();
    await reservar(db, a.f.id, a.m.agendamento, a.p);
    await db.query(`select whatsapp_cloud_registar_optout($1, 'PARAR', 'w')`, [h("+351911111111")]);
    await db.query(`delete from auth.users where id=$1`, [a.p.usuario]);
    for (const t of ["whatsapp_cloud_envios", "whatsapp_cloud_consentimentos", "whatsapp_cloud_profissionais"]) {
      assert.equal((await db.query(`select count(*)::int n from ${t}`)).rows[0].n, 0, t);
    }
    assert.equal((await db.query(`select count(*)::int n from whatsapp_cloud_bloqueios`)).rows[0].n, 1);
  });

  test("whatsapp_cloud_eliminar_dados_profissional apaga só a profissional indicada", async () => {
    const a = await linhaReservada();
    const b = await linhaReservada();
    await reservar(db, a.f.id, a.m.agendamento, a.p, { chave: "ka" });
    await reservar(db, b.f.id, b.m.agendamento, b.p, { chave: "kb" });
    const { rows: [r] } = await db.query(`select whatsapp_cloud_eliminar_dados_profissional($1) r`, [a.p.usuario]);
    assert.deepEqual(r.r, { envios: 1, consentimentos: 1, adesao: 1 });
    assert.equal((await db.query(`select count(*)::int n from whatsapp_cloud_envios`)).rows[0].n, 1);
  });
});

describe("migration", () => {
  test("pode ser aplicada uma segunda vez sem erros (idempotente)", async () => {
    await db.query(await readFile(path.join(raiz, "supabase_migration_whatsapp_cloud.sql"), "utf8"));
  });

  test("sem adesões, o comportamento da fila é exatamente o atual", async () => {
    const p = await criarProfissional({ adesao: null });
    const f = await inserirFila(p, (await criarMarcacao(p)).agendamento);
    assert.equal(f.canal, "whatsapp");
    assert.deepEqual((await reivindicarAntigo()).map((r) => r.id), [f.id]);
  });
});
