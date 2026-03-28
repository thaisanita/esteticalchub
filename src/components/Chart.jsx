import React from "react";
import PropTypes from "prop-types";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler, // Adicionado para permitir o preenchimento abaixo da linha
} from "chart.js";
import { Line } from "react-chartjs-2";

// Registrar os elementos do gráfico
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Chart({ labels = [], values = [] }) {
  // Se os dados ainda estiverem carregando ou vazios, mostra um estado amigável
  if (!labels || labels.length === 0) {
    return (
      <div style={styles.vazio}>
        <p style={{ color: '#94a3b8' }}>Aguardando dados faturados...</p>
      </div>
    );
  }

  const data = {
    labels,
    datasets: [
      {
        label: "Faturamento (€)",
        data: values,
        borderColor: "#4f46e5",
        backgroundColor: "rgba(79, 70, 229, 0.1)",
        borderWidth: 3,
        pointBackgroundColor: "#4f46e5",
        pointBorderColor: "#fff",
        pointHoverRadius: 6,
        fill: true, // Cria aquele efeito de área preenchida suave
        tension: 0.4, // Deixa a linha curvada (mais moderno)
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // Permite controlar a altura via CSS
    plugins: {
      legend: {
        display: false, // Esconde a legenda para um visual mais limpo
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: { size: 14 },
        bodyFont: { size: 14 },
        displayColors: false,
        callbacks: {
          label: (context) => `Total: € ${context.parsed.y.toFixed(2)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 10 } }
      }
    }
  };

  return (
    <div style={styles.container}>
      <Line data={data} options={options} />
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    height: "250px", // Altura fixa para manter o layout estável
    padding: "10px",
    backgroundColor: "#fff",
    borderRadius: "12px",
  },
  vazio: {
    height: "250px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px dashed #e2e8f0",
    borderRadius: "12px",
    backgroundColor: "#f8fafc"
  }
};

Chart.propTypes = {
  labels: PropTypes.arrayOf(PropTypes.string),
  values: PropTypes.arrayOf(PropTypes.number),
};