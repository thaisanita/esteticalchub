import React, { useEffect, useState } from 'react';
import { Line } from "react-chartjs-2";
import { supabase } from '../supabase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

export default function Graficos() {
  const [dadosGrafico, setDadosGrafico] = useState({ labels: [], datasets: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    setLoading(true);
    try {
      const { data: agendamentos, error } = await supabase.from('agendamentos').select('*');
      if (error) throw error;

      const faturamentoPorMes = {};
      const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

      if (agendamentos) {
        agendamentos.forEach(ag => {
          if (ag.data) {
            const mesIndices = new Date(ag.data + 'T00:00:00').getMonth();
            const mesNome = nomesMeses[mesIndices];
            const valorBruto = ag.valor || ag.preco || '0';
            const valor = parseFloat(String(valorBruto).replace(',', '.'));
            faturamentoPorMes[mesNome] = (faturamentoPorMes[mesNome] || 0) + valor;
          }
        });
      }

      const labels = nomesMeses.filter(mes => faturamentoPorMes[mes] !== undefined);
      const valores = labels.map(mes => faturamentoPorMes[mes]);

      setDadosGrafico({
        labels: labels.length > 0 ? labels : ["Sem dados"],
        datasets: [{
          label: "Faturamento Mensal (€)",
          data: valores.length > 0 ? valores : [0],
          borderColor: "#4f46e5",
          backgroundColor: "rgba(79, 70, 229, 0.08)",
          fill: true,
          tension: 0.45,
          pointRadius: 5,
          pointBackgroundColor: "#fff",
          pointBorderColor: "#4f46e5",
          pointBorderWidth: 2,
          pointHoverRadius: 7
        }],
      });
    } catch (error) {
      console.error("Erro ao carregar gráficos:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={s.loadingWrapper}>
      <div style={s.loadingDot} />
      <span style={s.loadingText}>A carregar estatísticas...</span>
    </div>
  );

  return (
    <div className="agenda-page-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500&display=swap');
      `}</style>
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div>
            <h2 style={s.cardTitle}>Análise de Faturamento</h2>
            <p style={s.cardSub}>Evolução mensal dos seus ganhos</p>
          </div>
          <div style={s.badge}>📈 Real</div>
        </div>
        <div style={{ height: "280px", marginTop: '10px' }}>
          <Line
            data={dadosGrafico}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: '#1e1b4b',
                  titleColor: '#a5b4fc',
                  bodyColor: '#fff',
                  borderColor: '#4f46e5',
                  borderWidth: 1,
                  cornerRadius: 10,
                  padding: 12,
                  callbacks: {
                    label: (ctx) => ` € ${ctx.parsed.y.toFixed(2)}`
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: '#f1f5f9', drawBorder: false },
                  ticks: { color: '#94a3b8', font: { family: "'DM Sans'" }, callback: v => `€${v}` }
                },
                x: {
                  grid: { display: false },
                  ticks: { color: '#94a3b8', font: { family: "'DM Sans'" } }
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

const s = {
  loadingWrapper: {
    display: 'flex', alignItems: 'center', gap: '10px',
    justifyContent: 'center', padding: '40px',
    fontFamily: "'DM Sans', sans-serif"
  },
  loadingDot: {
    width: '8px', height: '8px', borderRadius: '50%', background: '#4f46e5',
    animation: 'pulse 1s infinite'
  },
  loadingText: { color: '#94a3b8', fontSize: '14px' },
  card: {
    background: '#fff', borderRadius: '18px', padding: '24px',
    boxShadow: '0 2px 16px rgba(79,70,229,0.06)', border: '1px solid #ede9fe'
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: {
    fontFamily: "'Sora', sans-serif", fontSize: '16px', fontWeight: '700', color: '#1e1b4b'
  },
  cardSub: { fontSize: '12px', color: '#94a3b8', marginTop: '3px' },
  badge: {
    background: '#ede9fe', color: '#4f46e5', fontSize: '11px',
    fontWeight: '700', padding: '5px 12px', borderRadius: '20px'
  }
};