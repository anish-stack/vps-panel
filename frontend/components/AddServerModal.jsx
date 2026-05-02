'use client';
import { useState } from 'react';
import { serversApi } from '../lib/api';

export default function AddServerModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', ip: '', port: '7001', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await serversApi.create({
        ...form,
        port: parseInt(form.port) || 7001,
      });
      setCreatedKey(data.apiKey);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add server');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDone = () => {
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            {createdKey ? '🎉 Server Added' : 'Add Server'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {createdKey ? (
            /* Show API Key - ONCE */
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-amber-400 font-medium text-sm">Save this API key now!</p>
                    <p className="text-amber-400/70 text-xs mt-1">
                      This key won't be shown again. Copy it and set it as <code className="bg-black/30 px-1 rounded">API_KEY</code> in your agent's <code className="bg-black/30 px-1 rounded">.env</code>.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">API Key</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-green-400 font-mono text-sm break-all">
                    {createdKey}
                  </code>
                  <button onClick={copyKey} className="btn-ghost px-3 flex-shrink-0">
                    {copied ? (
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 font-medium mb-2">Install agent on your VPS:</p>
                <code className="text-xs text-green-400 font-mono">
                  curl -s https://yourpanel.com/install.sh | API_KEY={createdKey.substring(0, 16)}... bash
                </code>
              </div>

              <button onClick={handleDone} className="btn-primary w-full text-center">
                Done — Go to Dashboard
              </button>
            </div>
          ) : (
            /* Add server form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="label">Server Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Production Server"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="label">IP Address / Hostname</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="192.168.1.1"
                    value={form.ip}
                    onChange={e => setForm(p => ({ ...p, ip: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Agent Port</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="7001"
                    value={form.port}
                    onChange={e => setForm(p => ({ ...p, port: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="label">Description <span className="text-gray-600">(optional)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Main web server"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Adding...' : 'Add Server'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
