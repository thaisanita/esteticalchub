/**
 * Calcula os totais financeiros de uma lista de agendamentos.
 * Suporta campos do Supabase (valor, custo_produtos) e legados (price, product_cost).
 */
export function computeTotals(appointments) {
  if (!appointments || !Array.isArray(appointments)) {
    return { revenue: 0, cost: 0, profit: 0 };
  }

  return appointments.reduce((acc, a) => {
    // 1. Tratamento da Receita (valor ou price)
    const rawPrice = a.valor ?? a.price ?? 0;
    const price = typeof rawPrice === 'string' 
      ? parseFloat(rawPrice.replace(',', '.')) 
      : Number(rawPrice);

    // 2. Tratamento do Custo (custo_produtos ou product_cost)
    const rawCost = a.custo_produtos ?? a.product_cost ?? 0;
    const cost = typeof rawCost === 'string' 
      ? parseFloat(rawCost.replace(',', '.')) 
      : Number(rawCost);

    // 3. Acumulação
    acc.revenue += (price || 0);
    acc.cost += (cost || 0);
    acc.profit += ((price || 0) - (cost || 0));

    return acc;
  }, { revenue: 0, cost: 0, profit: 0 });
}