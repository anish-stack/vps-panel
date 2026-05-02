'use client';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { serversApi } from '../lib/api';

export default function ServerCard({ server, onDelete }) {
  const queryClient = useQueryClient();

  const pingMutation = useMutation({
    mutationFn: () => serversApi.ping(server._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const statusBadge = {
    online: 'badge-online',
    offline: 'badge-offline',
    unknown: 'badge-unknown',
  }[server.status] || 'badge-unknown';

  const statusDot = {
    online: 'bg-green-400',
    offline: 'bg-red-400',
    unknown: 'bg-gray-400',
  }[server.status] || 'bg-gray-400';

  return (
    <div className="card hover:border-gray-700 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{server.name}</h3>
          <p className="text-gray-500 text-sm mt-0.5 font-mono">{server.ip}:{server.port}</p>
        </div>
        <span className={statusBadge}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot} ${server.status === 'online' ? 'animate-pulse' : ''}`} />
          {server.status}
        </span>
      </div>

      {/* Description */}
      {server.description && (
        <p className="text-gray-500 text-sm mb-4 truncate">{server.description}</p>
      )}

      {/* API Key prefix */}
      <div className="bg-gray-800/50 rounded-lg px-3 py-2 mb-4">
        <p className="text-xs text-gray-500">API Key</p>
        <p className="text-xs font-mono text-gray-400">{server.apiKeyPrefix}••••••••••••••••</p>
      </div>

      {/* Last seen */}
      {server.lastSeen && (
        <p className="text-xs text-gray-600 mb-4">
          Last seen: {new Date(server.lastSeen).toLocaleString()}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-800">
        <Link
          href={`/dashboard/server/${server._id}`}
          className="btn-primary flex-1 text-center text-sm py-1.5"
        >
          Manage
        </Link>
        <button
          onClick={() => pingMutation.mutate()}
          disabled={pingMutation.isPending}
          className="btn-ghost text-sm py-1.5 px-3"
          title="Ping server"
        >
          {pingMutation.isPending ? (
            <span className="inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          )}
        </button>
        <button
          onClick={onDelete}
          className="text-gray-600 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10"
          title="Delete server"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
