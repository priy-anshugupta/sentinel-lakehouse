import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchOlapQuery, fetchPivotQuery } from '../lib/api';

export const useOlapQuery = (params, debounceMs = 200) => {
  const [data, setData] = useState(null);
  const [sql, setSql] = useState(null);
  const [executionMs, setExecutionMs] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const timeoutRef = useRef(null);
  const requestIdRef = useRef(0);

  const executeQuery = useCallback(async (queryParams, requestId = ++requestIdRef.current) => {
    if (!queryParams) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      let result;
      if (queryParams.operation === 'PIVOT') {
        result = await fetchPivotQuery({
          row_dim: queryParams.row_dim || 'day_of_week',
          col_dim: queryParams.col_dim || 'type_name',
          measure: queryParams.measure || 'sum_amount'
        });
      } else {
        result = await fetchOlapQuery(queryParams);
      }
      if (requestId === requestIdRef.current) {
        setData(result?.data || []);
        setSql(result?.sql || '');
        setExecutionMs(result?.execution_ms ?? null);
      }
    } catch (err) {
      console.warn("OLAP Query Error:", err);
      const detail = err.response?.data?.detail;
      if (requestId === requestIdRef.current) setError(typeof detail === 'string' ? detail : Array.isArray(detail)
        ? detail.map(item => item.msg || 'Invalid query parameter').join('; ')
        : err.message || 'An error occurred');
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    executeQuery(params);
  }, [executeQuery, params]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const requestId = ++requestIdRef.current;
    setData(null);
    setSql(null);
    setExecutionMs(null);
    setError(null);
    setIsLoading(Boolean(params));

    timeoutRef.current = setTimeout(() => {
      executeQuery(params, requestId);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [JSON.stringify(params), debounceMs, executeQuery]);

  return { 
    data, 
    sql, 
    executionMs, 
    execTime: executionMs, 
    isLoading, 
    loading: isLoading, 
    error, 
    refetch 
  };
};

export default useOlapQuery;
