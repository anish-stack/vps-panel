'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serversApi } from '../../../../lib/api';
import StatsChart from '../../../../components/StatsChart';
import LogsViewer from '../../../../components/LogsViewer';
import BackupList from '../../../../components/BackupList';
import Link from 'next/link';

const PM2_STATUS_COLORS = {
  online: 'text-green-400 bg-green-500/10 border-green-500/20',
  stopped: 'text-red-400 bg-red-500/10 border-red-500/20',
  errored: 'text-red-400 bg-red-500/10 border-red-500/20',
  launching: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
};

function formatUptime(ms) {
  if (!ms) return '—';
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const mb = bytes / 1024 / 1024;
  return mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
}

export default function ServerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedApp, setSelectedApp] = useState(null);

  // Server info
  const { data: serverData } = useQuery({
    queryKey: ['server', id],
    queryFn: () => serversApi.get(id).then(r => r.data.server),
  });

  // Stats - poll every 10 seconds
  const { data: statsData, error: statsError, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', id],
    queryFn: () => serversApi.getStatus(id).then(r => r.data.stats),
    refetchInterval: 10000,
    retry: 1,
  });

  // Apps
  const { data: appsData, refetch: refetchApps } = useQuery({
    queryKey: ['apps', id],
    queryFn: () => serversApi.getApps(id).then(r => r.data.apps),
    refetchInterval: 15000,
  });
  console.log("appsData",appsData)

  const restartMutation = useMutation({
    mutationFn: (appName) => serversApi.restartApp(id, appName),
    onSuccess: () => {
      setTimeout(() => refetchApps(), 1500);
    },
  });

  const stopMutation = useMutation({
    mutationFn: (appName) => serversApi.stopApp(id, appName),
    onSuccess: () => {
      setTimeout(() => refetchApps(), 1500);
    },
  });

  const server = serverData;
  const stats = statsData;
  const apps = appsData || [];

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'apps', label: `Apps (${apps.length})` },
    { id: 'logs', label: 'Logs' },
    { id: 'backups', label: 'Backups' },
  ];

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-white">{server?.name || 'Loading...'}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{server?.name || '...'}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${
              server?.status === 'online' ? 'badge-online' :
              server?.status === 'offline' ? 'badge-offline' : 'badge-unknown'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 ${
                server?.status === 'online' ? 'bg-green-400 animate-pulse' :
                server?.status === 'offline' ? 'bg-red-400' : 'bg-gray-400'
              }`} />
              {server?.status || 'unknown'}
            </span>
          </div>
          <p className="text-gray-500 mt-1 font-mono text-sm">{server?.ip}:{server?.port}</p>
        </div>
      </div>

      {/* Quick stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <QuickStat label="CPU" value={`${stats.cpu?.loadPercent?.toFixed(1)}%`} color="sky" />
          <QuickStat label="RAM" value={`${stats.memory?.usePercent?.toFixed(1)}%`} color="purple" />
          <QuickStat
            label="Disk"
            value={`${stats.disk?.[0]?.usePercent?.toFixed(1) ?? '—'}%`}
            color="orange"
          />
          <QuickStat
            label="Uptime"
            value={formatUptime2(stats.uptime?.seconds)}
            color="green"
          />
        </div>
      )}

      {statsError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg mb-6">
          ⚠️ Cannot reach agent: {statsError.response?.data?.error || 'Agent offline or wrong API key'}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-sky-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="card h-64 animate-pulse bg-gray-900/50" />
              <div className="card h-64 animate-pulse bg-gray-900/50" />
            </div>
          ) : (
            <StatsChart stats={stats} />
          )}

          {/* Disk info */}
          {stats?.disk && stats.disk.length > 0 && (
            <div className="card">
              <h3 className="font-medium text-white mb-4">Disk Usage</h3>
              <div className="space-y-3">
                {stats.disk.map((d, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-400 font-mono">{d.mount}</span>
                      <span className="text-gray-500">
                        {formatBytes(d.used * 1024)} / {formatBytes(d.size * 1024)} ({d.usePercent?.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          d.usePercent > 85 ? 'bg-red-500' :
                          d.usePercent > 70 ? 'bg-orange-500' : 'bg-sky-500'
                        }`}
                        style={{ width: `${Math.min(d.usePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OS info */}
          {stats?.os && (
            <div className="card">
              <h3 className="font-medium text-white mb-4">System Info</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">OS</dt>
                  <dd className="text-gray-200 mt-0.5">{stats.os.distro} {stats.os.release}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Hostname</dt>
                  <dd className="text-gray-200 mt-0.5 font-mono">{stats.os.hostname}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Architecture</dt>
                  <dd className="text-gray-200 mt-0.5">{stats.os.arch}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">CPU</dt>
                  <dd className="text-gray-200 mt-0.5">{stats.cpu?.brand}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}

      {activeTab === 'apps' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-medium text-white">PM2 Applications</h3>
            <button onClick={() => refetchApps()} className="btn-ghost text-xs py-1.5 px-3">
              Refresh
            </button>
          </div>

        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* App selector */}
          
          <LogsViewer serverId={id} appName={selectedApp} />
        </div>
      )}

      {activeTab === 'backups' && (
        <BackupList serverId={id} />
      )}
    </div>
  );
}

function QuickStat({ label, value, color }) {
  const colors = {
    sky: 'text-sky-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    green: 'text-green-400',
  };

  return (
    <div className="card">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</p>
    </div>
  );
}

function formatUptime2(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
