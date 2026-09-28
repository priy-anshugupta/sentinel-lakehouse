import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../lib/constants';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const activeRef = useRef(true);

  const connect = useCallback(() => {
    if (!activeRef.current) return;
    try {
      setConnectionStatus('Connecting');
      const token = sessionStorage.getItem('sentinel_token');
      if (!token) { setConnectionStatus('Closed'); return; }
      wsRef.current = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('Open');
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (error) {
          console.error('Error parsing WS message', error);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('Closed');
        if (activeRef.current) scheduleReconnect();
      };

      wsRef.current.onerror = (error) => {
        console.warn('WebSocket connection not ready:', error);
        setIsConnected(false);
        setConnectionStatus('Closed');
        wsRef.current?.close();
      };
    } catch (error) {
      console.warn('WebSocket connection error:', error);
      setIsConnected(false);
      setConnectionStatus('Closed');
      scheduleReconnect();
    }
  }, []);

  const scheduleReconnect = () => {
    if (!activeRef.current) return;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, up to 30s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectAttempts.current += 1;
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  };

  useEffect(() => {
    activeRef.current = true;
    connect();
    return () => {
      activeRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
    }
  }, []);

  return { 
    isConnected, 
    connectionStatus, 
    lastMessage, 
    sendMessage 
  };
};

export default useWebSocket;
