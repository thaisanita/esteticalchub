import React from "react";
import PropTypes from "prop-types";

export default function Resumo({ appointments }) {
  const totals = (appointments || []).reduce((acc, ag) => {
    const priceRaw = ag.valor || ag.preco || 0;
    const costRaw = ag.custo_produtos || ag.product_cost || 0;
    const price = typeof priceRaw === 'string' ? parseFloat(priceRaw.replace(',', '.')) : priceRaw;
    const cost = typeof costRaw === 'string' ? parseFloat(costRaw.replace(',', '.')) : costRaw;
    return {
      revenue: acc.revenue + (price || 0),
      cost: acc.cost + (cost || 0),
      profit: acc.profit + ((price || 0) - (cost || 0))
    };
  }, { revenue: 0, cost: 0, profit: 0 });

  const cards = [
    { label: 'RECEITA', valor: totals.revenue, color: '#1e1b4b', bg: '#f8f7ff', border: '#ede9fe', icon: '💶' },
    { label: 'CUSTO PROD.', valor: totals.cost, color: '#ef4444', bg: '#fff5f5', border: '#fee2e2', icon: '📦' },
    { label: 'LUCRO ESTIMADO', valor: totals.profit, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' }
  ];

  return (
    <div style={s.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
      `}</style>
      <div style={s.header}>
        <span style={s.headerIcon}>📋</span>
        <h2 style={s.titulo}>Resumo do Dia</h2>
      </div>
      <div style={s.grid}>
        {cards.map(card => (
          <div key={card.label} style={{ ...s.card, background: card.bg, border: `1px solid ${card.border}` }}>
            <div style={s.cardTop}>
              <span style={s.cardIcon}>{card.icon}</span>
              <span style={s.cardLabel}>{card.label}</span>
            </div>
            <div style={{ ...s.cardValor, color: card.color }}>
              € {card.valor.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  container: {
    background: '#fff', borderRadius: '16px', padding: '22px 24px',
    boxShadow: '0 2px 12px rgba(79,70,229,0.06)', border: '1px solid #ede9fe',
    margin: '20px 0', fontFamily: "'DM Sans', sans-serif"
  },
  header: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' },
  headerIcon: { fontSize: '18px' },
  titulo: {
    fontFamily: "'Sora', sans-serif", fontSize: '14px', fontWeight: '700',
    color: '#1e1b4b', textTransform: 'uppercase', letterSpacing: '1px'
  },
  grid: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  card: {
    flex: 1, minWidth: '110px', borderRadius: '12px', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: '8px'
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: '6px' },
  cardIcon: { fontSize: '14px' },
  cardLabel: { fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.8px' },
  cardValor: { fontFamily: "'Sora', sans-serif", fontSize: '20px', fontWeight: '800' }
};

Resumo.propTypes = {
  appointments: PropTypes.array
};