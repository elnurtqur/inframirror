import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:8000';

export const useApi = () => {
  const [loading, setLoading] = useState({});

  const addLog = useCallback((message, type = 'info', logs, setLogs) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{
      id: Date.now(),
      timestamp,
      message,
      type
    }, ...prev.slice(0, 49)]);
  }, []);

  const apiCall = useCallback(async (endpoint, options = {}, logs, setLogs) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      addLog(`API Error: ${error.message}`, 'error', logs, setLogs);
      throw error;
    }
  }, [addLog]);

  const setLoadingState = useCallback((key, value) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    loading,
    setLoadingState,
    apiCall,
    addLog
  };
};