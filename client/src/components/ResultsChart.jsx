import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function ResultsChart({ summary }) {
  const data = {
    labels: ['Yes', 'No'],
    datasets: [
      {
        data: [summary.yes, summary.no],
        backgroundColor: ['#4ade80', '#f87171'],
        borderColor: ['#16a34a', '#dc2626'],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#e2e8f0',
          font: { size: 14 },
        },
      },
    },
  };

  const total = summary.yes + summary.no;
  if (total === 0) return null;

  return (
    <div className="results-chart">
      <h3>Distribution</h3>
      <div className="chart-container">
        <Doughnut data={data} options={options} />
      </div>
      <div className="chart-stats">
        <p>Yes: {summary.yes} ({((summary.yes / total) * 100).toFixed(1)}%)</p>
        <p>No: {summary.no} ({((summary.no / total) * 100).toFixed(1)}%)</p>
      </div>
    </div>
  );
}
