import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

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

interface ChartProps {
  labels?: string[];
  values?: number[];
}

// Cores atualizadas para a paleta clara em cinza
const COLORS = {
  primary: '#7C3AED',
  primaryHover: '#8B5CF6',
  card: '#D8DCE2',             /* Cinza dos cards para bordas/pontos */
  tooltipBg: '#FFFFFF',        /* Fundo do tooltip em branco limpo */
  border: '#C8CCD2',           /* Bordas em tom de cinza suave */
  textDark: '#1E293B',         /* Texto principal escuro */
  mutedForeground: '#64748B',  /* Texto secundário/eixos em cinza */
  gridLines: 'rgba(0, 0, 0, 0.06)', /* Linhas do grid suaves em tom escuro sutil */
};

export default function Chart({ labels = [], values = [] }: ChartProps) {
  if (!labels || labels.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center rounded-xl border border-dashed border-border bg-card">
        <p className="text-sm text-muted-foreground">Aguardando dados faturados...</p>
      </div>
    );
  }

  const data = {
    labels,
    datasets: [
      {
        label: 'Faturamento (€)',
        data: values,
        borderColor: COLORS.primary,
        backgroundColor: 'rgba(124, 58, 237, 0.12)',
        borderWidth: 2.5,
        pointBackgroundColor: COLORS.primary,
        pointBorderColor: COLORS.card,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: COLORS.tooltipBg,
        borderColor: COLORS.border,
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 13, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, weight: 700 as const, family: "'Inter', sans-serif" },
        titleColor: COLORS.textDark,
        bodyColor: COLORS.primaryHover,
        displayColors: false,
        callbacks: {
          label: (context: any) => `Total: € ${context.parsed.y.toFixed(2)}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: COLORS.gridLines },
        ticks: { color: COLORS.mutedForeground, font: { size: 10, family: "'Inter', sans-serif" } },
      },
      x: {
        grid: { display: false },
        ticks: { color: COLORS.mutedForeground, font: { size: 10, family: "'Inter', sans-serif" } },
      },
    },
  };

  return (
    <div className="h-[250px] w-full rounded-xl bg-transparent p-2.5">
      <Line data={data} options={options} />
    </div>
  );
}