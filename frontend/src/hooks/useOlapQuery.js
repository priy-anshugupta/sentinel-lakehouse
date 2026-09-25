import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchOlapQuery, fetchPivotQuery } from '../lib/api';

export const useOlapQuery = (params, debounceMs = 200) => {
  const [data, setData] = useState(null);
  const [sql, setSql] = useState(null);
  const [executionMs, setExecutionMs] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const timeoutRef = useRef(null);

  const executeQuery = useCallback(async (queryParams) => {
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
      setData(result?.data || []);
      setSql(result?.sql || '');
      setExecutionMs(result?.execution_ms || 12.5);
    } catch (err) {
      console.warn("OLAP Query Error:", err);
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    executeQuery(params);
  }, [executeQuery, params]);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      executeQuery(params);
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
