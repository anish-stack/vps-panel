'use client';
import { useEffect, useRef, useState } from 'react';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const MAX_POINTS = 20;

function buildDataset(label, color, data) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: `${color}20`,
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    fill: true,
    tension: 0.4,
  };
}

const chartOptions = (yLabel) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  scales: {
    x: {
      grid: { color: '#1f2937' },
      ticks: { color: '#6b7280', maxTicksLimit: 6, font: { size: 11 } },
    },
    y: {
      min: 0,
      max: 100,
      grid: { color: '#1f2937' },
      ticks: {
        color: '#6b7280',
        font: { size: 11 },
        callback: (v) => `${v}%`,
      },
    },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111827',
      borderColor: '#374151',
      borderWidth: 1,
      callbacks: {
        label: (ctx) => ` ${ctx.parsed.y.toFixed(1)}%`,
      },
    },
  },
});

export default function StatsChart({ stats }) {
  const [history, setHistory] = useState({
    labels: [],
    cpu: [],
    ram: [],
  });

  useEffect(() => {
    if (!stats) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setHistory(prev => {
      const labels = [...prev.labels, now].slice(-MAX_POINTS);
      const cpu = [...prev.cpu, stats.cpu?.loadPercent ?? 0].slice(-MAX_POINTS);
      const ram = [...prev.ram, stats.memory?.usePercent ?? 0].slice(-MAX_POINTS);
      return { labels, cpu, ram };
    });
  }, [stats]);

  const cpuData = {
    labels: history.labels,
    datasets: [buildDataset('CPU', '#0ea5e9', history.cpu)],
  };

  const ramData = {
    labels: history.labels,
    datasets: [buildDataset('RAM', '#a855f7', history.ram)],
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-white">CPU Usage</h3>
          <span className="text-2xl font-bold text-sky-400">
            {stats?.cpu?.loadPercent?.toFixed(1) ?? '—'}%
          </span>
        </div>
        <div className="h-40">
          <Line data={cpuData} options={chartOptions('CPU')} />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span>Cores: {stats?.cpu?.cores ?? '—'}</span>
          <span>{stats?.cpu?.brand ?? ''}</span>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-white">RAM Usage</h3>
          <span className="text-2xl font-bold text-purple-400">
            {stats?.memory?.usePercent?.toFixed(1) ?? '—'}%
          </span>
        </div>
        <div className="h-40">
          <Line data={ramData} options={chartOptions('RAM')} />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span>Used: {formatBytes(stats?.memory?.used)}</span>
          <span>Total: {formatBytes(stats?.memory?.total)}</span>
          <span>Free: {formatBytes(stats?.memory?.free)}</span>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}
