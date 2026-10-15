// Pequeno barramento de eventos para avisar páginas de que algo mudou nos
// bastidores, sem precisar de contexto/props atravessando o layout. Usado
// pelo botão flutuante "pagamento rápido" (montado em App.tsx, fora de
// qualquer página) para avisar a Agenda/Atendimentos do Dia a atualizarem-se.
export const EVENTO_PAGAMENTO_REGISTADO = 'pagamento-registado';

export function avisarPagamentoRegistado() {
  window.dispatchEvent(new CustomEvent(EVENTO_PAGAMENTO_REGISTADO));
}
