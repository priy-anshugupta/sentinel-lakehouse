import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../lib/constants';

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    try {
      setConnectionStatus('Connecting');
      wsRef.current = new WebSocket(WS_URL);

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
        scheduleReconnect();
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
    connect();
    return () => {
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
