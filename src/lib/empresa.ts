// Dados de identificação do prestador do serviço. Aparecem no rodapé, nos
// Termos de Uso e na Política de Privacidade.
//
// A lei exige que um site que presta serviços online mostre de forma
// permanente o nome/denominação, morada, email de contacto e NIF do prestador
// (Decreto-Lei n.º 7/2004, art. 10.º). PREENCHER antes de divulgar o site —
// os campos vazios simplesmente não aparecem.
export const EMPRESA = {
  nomeComercial: 'EstetiCalcHub',
  /** Nome do ENI ou denominação social. Ex.: "Maria Silva, ENI" ou "EstetiCalcHub, Unipessoal, Lda." */
  titular: '',
  nif: '',
  /** Morada completa da sede / do estabelecimento. */
  morada: '',
  email: 'suporte.esteticalchub@gmail.com',
  /** Comarca para o foro, ex.: "Lisboa". Se vazio, usa-se "os tribunais portugueses competentes". */
  foro: '',
  /** Link do teu Livro de Reclamações Eletrónico (livroreclamacoes.pt), depois de registares o negócio. */
  livroReclamacoesUrl: '',
};

export const DATA_ATUALIZACAO_LEGAL = 'Setembro de 2026';

export const identificacaoPrestador = () =>
  [EMPRESA.titular, EMPRESA.nif && `NIF ${EMPRESA.nif}`, EMPRESA.morada].filter(Boolean).join(' · ');
