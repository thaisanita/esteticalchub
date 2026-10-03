// IDs dos preços no Stripe (Dashboard → Produtos → cria o produto "EstetiCalcHub Pro"
// com dois preços: um recorrente mensal, outro recorrente anual). Substitui os
// valores abaixo pelos "price_..." reais antes de ativar os botões de assinar.
export const STRIPE_PRICE_IDS = {
  mensal: 'price_SUBSTITUIR_MENSAL',
  anual: 'price_SUBSTITUIR_ANUAL',
} as const;
