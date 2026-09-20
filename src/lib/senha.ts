// Regras de senha do EstetiCalcHub — usadas no registo e na recuperação de senha.
// Atenção: isto valida no navegador. A regra "de verdade" (que ninguém contorna
// chamando a API diretamente) tem de estar também nas definições do Supabase
// (Authentication → Sign In / Providers → Email → tamanho mínimo e requisitos).

const SENHAS_COMUNS = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345678910', '0123456789',
  'password', 'password1', 'password123', 'qwerty', 'qwerty123', 'qwertyuiop', 'abc123',
  'abc12345', 'abcd1234', '111111', '000000', 'iloveyou', 'admin', 'admin123', 'letmein',
  'welcome', 'senha', 'senha123', 'senha1234', 'senha12345', 'mudar123', 'estetica',
  'esteticalchub', 'esteticalchub123', 'portugal', 'portugal123', 'benfica', 'sporting', 'porto',
]);

export interface RequisitoSenha {
  ok: boolean;
  texto: string;
}

export interface AvaliacaoSenha {
  requisitos: RequisitoSenha[];
  /** Cumpre todos os requisitos mínimos. */
  forte: boolean;
  nivel: 0 | 1 | 2 | 3 | 4;
  label: string;
}

export function avaliarSenha(senha: string, email = ''): AvaliacaoSenha {
  const baixa = senha.toLowerCase();
  const parteLocalEmail = email.split('@')[0].toLowerCase();
  // partes do email com 4+ letras (ex.: "thais.anita04" -> "thais", "anita04")
  const partesEmail = parteLocalEmail.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);

  const requisitos: RequisitoSenha[] = [
    { ok: senha.length >= 10, texto: 'Pelo menos 10 caracteres' },
    { ok: /[a-z]/.test(senha) && /[A-Z]/.test(senha), texto: 'Letras maiúsculas e minúsculas' },
    { ok: /\d/.test(senha), texto: 'Pelo menos um número' },
    {
      ok:
        senha.length > 0 &&
        !SENHAS_COMUNS.has(baixa) &&
        !partesEmail.some((parte) => baixa.includes(parte)) &&
        !/^(.)\1+$/.test(senha),
      texto: 'Não é uma senha comum nem contém o seu email',
    },
  ];

  const cumpridos = requisitos.filter((r) => r.ok).length;
  const forte = cumpridos === requisitos.length;
  const extra = /[^A-Za-z0-9]/.test(senha) || senha.length >= 14;

  let nivel: AvaliacaoSenha['nivel'] = 0;
  if (senha) nivel = 1;
  if (senha && cumpridos >= 2) nivel = 2;
  if (forte) nivel = extra ? 4 : 3;

  const labels = ['', 'Fraca', 'Média', 'Forte', 'Muito forte'];
  return { requisitos, forte, nivel, label: labels[nivel] };
}
