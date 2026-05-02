'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serversApi } from '../../lib/api';
import ServerCard from '../../components/ServerCard';
import AddServerModal from '../../components/AddServerModal';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['servers'],
    queryFn: () => serversApi.list().then(r => r.data.servers),
    refetchInterval: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => serversApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });

  const servers = data || [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {servers.length} server{servers.length !== 1 ? 's' : ''} connected
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Server
        </button>
      </div>

      {/* Stats summary */}
      {servers.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Total Servers"
            value={servers.length}
            color="sky"
          />
          <StatCard
            label="Online"
            value={servers.filter(s => s.status === 'online').length}
            color="green"
          />
          <StatCard
            label="Offline"
            value={servers.filter(s => s.status === 'offline').length}
            color="red"
          />
        </div>
      )}

      {/* Server list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse h-48 bg-gray-900/50" />
          ))}
        </div>
      ) : error ? (
        <div className="card border-red-500/30 text-center py-12">
          <p className="text-red-400">Failed to load servers</p>
          <p className="text-gray-600 text-sm mt-1">{error.message}</p>
        </div>
      ) : servers.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          <p className="text-gray-400 font-medium">No servers yet</p>
          <p className="text-gray-600 text-sm mt-1">Add your first VPS to get started</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary mt-6">
            Add Your First Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servers.map(server => (
            <ServerCard
              key={server._id}
              server={server}
              onDelete={() => {
                if (confirm(`Delete "${server.name}"?`)) {
                  deleteMutation.mutate(server._id);
                }
              }}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddServerModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ['servers'] });
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  return (
    <div className={`card border ${colors[color]}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color].split(' ')[0]}`}>{value}</p>
    </div>
  );
}
