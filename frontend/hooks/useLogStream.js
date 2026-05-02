'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

export function useLogStream(serverId, appName) {
  const socketRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      socket.emit('subscribe_logs', { serverId, appName, lines: 200 });
      setStreaming(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setStreaming(false);
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
      setConnected(false);
    });

    socket.on('log_start', () => {
      setLogs([]);
    });

    socket.on('log_line', (payload) => {
      setLogs(prev => {
        const newLogs = [...prev, payload];
        // Keep max 1000 lines in memory
        return newLogs.length > 1000 ? newLogs.slice(-1000) : newLogs;
      });
    });

    socket.on('log_error', (payload) => {
      setError(payload.message);
      setStreaming(false);
    });

    socket.on('log_end', () => {
      setStreaming(false);
    });
  }, [serverId, appName]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe_logs');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
      setStreaming(false);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { logs, connected, streaming, error, connect, disconnect, clearLogs };
}
