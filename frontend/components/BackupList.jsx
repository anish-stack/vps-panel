'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { serversApi } from '../lib/api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function BackupList({ serverId }) {
  const [dbName, setDbName] = useState('');
  const [backupDone, setBackupDone] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['backups', serverId],
    queryFn: () => serversApi.listBackups(serverId).then(r => r.data.backups),
    refetchInterval: 30000,
  });

  const backupMutation = useMutation({
    mutationFn: () => serversApi.triggerBackup(serverId, dbName || undefined),
    onSuccess: (res) => {
      setBackupDone(res.data);
      refetch();
    },
  });

  const handleDownload = async (filename) => {
    const token = localStorage.getItem('token');
    const url = serversApi.downloadBackupUrl(serverId, filename);

    // Fetch with auth header then trigger download
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      alert('Download failed');
      return;
    }

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const backups = data || [];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-medium text-white">MongoDB Backups</h3>
        <span className="text-xs text-gray-500">{backups.length} backup{backups.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Trigger backup */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-gray-300 mb-3">Create Backup</p>
        <div className="flex gap-3">
          <input
            type="text"
            className="input flex-1 text-sm py-2"
            placeholder="Database name (optional, blank = all)"
            value={dbName}
            onChange={e => setDbName(e.target.value)}
          />
          <button
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
            className="btn-primary whitespace-nowrap"
          >
            {backupMutation.isPending ? 'Backing up...' : 'Backup Now'}
          </button>
        </div>

        {backupMutation.isError && (
          <p className="text-red-400 text-xs mt-2">
            {backupMutation.error?.response?.data?.error || 'Backup failed'}
          </p>
        )}

        {backupDone && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-2 rounded-lg mt-3">
            ✅ Backup created: <span className="font-mono">{backupDone.result?.filename}</span>
            {backupDone.result?.size && ` (${formatBytes(backupDone.result.size)})`}
          </div>
        )}
      </div>

      {/* Backup list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : backups.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-10 h-10 text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <p className="text-gray-500 text-sm">No backups yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((backup) => (
            <div
              key={backup.filename}
              className="flex items-center justify-between bg-gray-800/40 border border-gray-800 rounded-lg px-4 py-3 hover:border-gray-700 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-gray-300 truncate">{backup.filename}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {new Date(backup.createdAt).toLocaleString()} · {formatBytes(backup.size)}
                </p>
              </div>
              <button
                onClick={() => handleDownload(backup.filename)}
                className="btn-ghost text-xs py-1.5 px-3 ml-3 flex items-center gap-1.5 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
