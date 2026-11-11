// Normalização de números de telefone para E.164 (formato exigido pela Cloud API).
//
// Regra deliberadamente conservadora: na dúvida, RECUSA. É preferível não
// enviar um lembrete do que enviá-lo para a pessoa errada.
//
//   "+351 912 345 678"   -> +351912345678
//   "00351912345678"     -> +351912345678
//   "351912345678"       -> +351912345678  (indicativo PT explícito, 12 dígitos)
//   "912345678"          -> +351912345678  (9 dígitos a começar por 9: telemóvel PT)
//   "212345678"          -> recusado       (fixo PT: não tem WhatsApp, em regra)
//   "33612345678"        -> recusado       (sem "+" não adivinhamos o país)
//   "+33612345678"       -> +33612345678   (internacional explícito, aceite)

export type ResultadoTelefone =
  | { ok: true; e164: string }
  | { ok: false; motivo: "vazio" | "caracteres_invalidos" | "formato_ambiguo" | "comprimento_invalido" | "nao_e_telemovel_pt" };

const PERMITIDOS = /^[+\d\s().\-\/]+$/;

export function normalizarTelefone(entrada: string | null | undefined): ResultadoTelefone {
  const bruto = (entrada ?? "").trim();
  if (!bruto) return { ok: false, motivo: "vazio" };
  if (!PERMITIDOS.test(bruto)) return { ok: false, motivo: "caracteres_invalidos" };

  // "+" só no início (opcionalmente dentro de um parêntese inicial: "(+351) ...").
  const temMais = /^\(?\s*\+/.test(bruto);
  const numeroDeMais = (bruto.match(/\+/g) ?? []).length;
  if (numeroDeMais > 1 || (numeroDeMais === 1 && !temMais)) {
    return { ok: false, motivo: "caracteres_invalidos" };
  }
  let digitos = bruto.replace(/\D/g, "");

  if (!temMais && digitos.startsWith("00")) {
    digitos = digitos.slice(2);
    return validarInternacional(digitos);
  }
  if (temMais) return validarInternacional(digitos);

  // Sem "+" nem "00":
  if (digitos.length === 9) {
    return digitos.startsWith("9")
      ? { ok: true, e164: `+351${digitos}` }
      : { ok: false, motivo: "nao_e_telemovel_pt" };
  }
  if (digitos.length === 12 && digitos.startsWith("3519")) {
    return { ok: true, e164: `+${digitos}` };
  }
  return { ok: false, motivo: "formato_ambiguo" };
}

function validarInternacional(digitos: string): ResultadoTelefone {
  // E.164: até 15 dígitos, sem zero inicial no indicativo. Mínimo prático: 8.
  if (digitos.length < 8 || digitos.length > 15) return { ok: false, motivo: "comprimento_invalido" };
  if (digitos.startsWith("0")) return { ok: false, motivo: "formato_ambiguo" };
  if (digitos.startsWith("351")) {
    const nacional = digitos.slice(3);
    if (nacional.length !== 9) return { ok: false, motivo: "comprimento_invalido" };
    if (!nacional.startsWith("9")) return { ok: false, motivo: "nao_e_telemovel_pt" };
  }
  return { ok: true, e164: `+${digitos}` };
}

/** "+351912345678" -> "+351*****678". Para logs e para a base de dados. */
export function mascararTelefone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length <= 6) return "+" + "*".repeat(d.length);
  const indicativo = d.startsWith("351") ? d.slice(0, 3) : d.slice(0, 2);
  const fim = d.slice(-3);
  return `+${indicativo}${"*".repeat(d.length - indicativo.length - 3)}${fim}`;
}
