'use client';
import { useEffect, useRef } from 'react';
import { useLogStream } from '../hooks/useLogStream';

export default function LogsViewer({ serverId, appName }) {
  const { logs, connected, streaming, error, connect, disconnect, clearLogs } = useLogStream(serverId, appName);
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const autoScrollRef = useRef(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  };

  const lineColor = (type) => {
    if (type === 'stderr') return 'text-red-400';
    if (type === 'error') return 'text-red-300';
    if (type === 'system') return 'text-yellow-500';
    return 'text-green-300';
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-white">Live Logs</h3>
          {appName && (
            <span className="bg-gray-800 text-gray-400 text-xs px-2 py-1 rounded-md font-mono">
              {appName}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-xs text-gray-500">
              {connected ? (streaming ? 'Streaming' : 'Connected') : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">{logs.length} lines</span>
          <button
            onClick={clearLogs}
            className="text-xs btn-ghost py-1 px-2"
            title="Clear logs"
          >
            Clear
          </button>
          {connected ? (
            <button onClick={disconnect} className="text-xs btn-danger py-1 px-3">
              Stop
            </button>
          ) : (
            <button onClick={connect} className="text-xs btn-primary py-1 px-3">
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg mb-3">
          {error}
        </div>
      )}

      {/* Terminal */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-gray-950 border border-gray-800 rounded-lg p-4 h-80 overflow-y-auto font-mono text-xs"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-700">
              {connected ? 'Waiting for logs...' : 'Click Connect to start streaming logs'}
            </p>
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-3 leading-5 hover:bg-gray-900/50 px-1 rounded">
              <span className="text-gray-700 flex-shrink-0 select-none">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={lineColor(log.type)}>
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Auto-scroll hint */}
      <p className="text-xs text-gray-700 mt-2">
        Scroll up to pause auto-scroll · {logs.length}/1000 lines buffered
      </p>
    </div>
  );
}
