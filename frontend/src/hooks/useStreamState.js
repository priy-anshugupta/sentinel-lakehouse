import { useState, useCallback } from 'react';
import { controlStream } from '../lib/api';

export const useStreamState = (wsSendMessage) => {
  const [state, setState] = useState('IDLE'); // IDLE | RUNNING | PAUSED
  const [currentStep, setCurrentStep] = useState(0);
  const [speed, setSpeedState] = useState(200);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [shiftInjected, setShiftInjected] = useState(false);
  const [metrics, setMetrics] = useState({
    accuracy: 0.974,
    f1Score: 0.892,
    processedCount: 0,
    errorCount: 0
  });

  const start = useCallback(async () => {
    try {
      await controlStream('START');
    } catch (error) {
      console.warn('REST stream start error/fallback', error);
    }
    if (wsSendMessage) {
      wsSendMessage({ action: 'start' });
    }
    setState('RUNNING');
  }, [wsSendMessage]);

  const pause = useCallback(async () => {
    try {
      await controlStream('PAUSE');
    } catch (error) {
      console.warn('REST stream pause error/fallback', error);
    }
    if (wsSendMessage) {
      wsSendMessage({ action: 'pause' });
    }
    setState('PAUSED');
  }, [wsSendMessage]);

  const reset = useCallback(async () => {
    try {
      await controlStream('RESET');
    } catch (error) {
      console.warn('REST stream reset error/fallback', error);
    }
    if (wsSendMessage) {
      wsSendMessage({ action: 'reset' });
    }
    setState('IDLE');
    setCurrentStep(0);
    setTotalProcessed(0);
    setShiftInjected(false);
    setMetrics({
      accuracy: 0.974,
      f1Score: 0.892,
      processedCount: 0,
      errorCount: 0
    });
  }, [wsSendMessage]);

  const inject = useCallback(async () => {
    try {
      await controlStream('INJECT');
    } catch (error) {
      console.warn('REST stream inject error/fallback', error);
    }
    if (wsSendMessage) {
      wsSendMessage({ action: 'inject' });
    }
    setShiftInjected(true);
  }, [wsSendMessage]);

  const setSpeed = useCallback(async (newSpeed) => {
    try {
      await controlStream('SET_SPEED', newSpeed);
    } catch (error) {
      console.warn('REST stream set speed error/fallback', error);
    }
    if (wsSendMessage) {
      wsSendMessage({ action: 'set_speed', speed: newSpeed });
    }
    setSpeedState(newSpeed);
  }, [wsSendMessage]);
  
  const updateFromWs = useCallback((wsData) => {
    if (!wsData) return;
    if (wsData.total_processed !== undefined) {
      setTotalProcessed(wsData.total_processed);
    }
    if (wsData.step !== undefined) {
      setCurrentStep(wsData.step);
    }
    setMetrics(prev => ({
      ...prev,
      processedCount: wsData.total_processed ?? prev.processedCount,
      accuracy: wsData.accuracy !== undefined ? wsData.accuracy : prev.accuracy,
      f1Score: wsData.f1Score !== undefined ? wsData.f1Score : prev.f1Score,
      errorCount: wsData.errorCount !== undefined ? wsData.errorCount : prev.errorCount
    }));
  }, []);

  return {
    state,
    isRunning: state === 'RUNNING',
    isPaused: state === 'PAUSED',
    currentStep,
    step: currentStep,
    speed,
    totalProcessed,
    shiftInjected,
    metrics,
    setMetrics,
    setCurrentStep,
    startStream: start,
    pauseStream: pause,
    resetStream: reset,
    updateSpeed: setSpeed,
    injectFraudShift: inject,
    actions: { start, pause, reset, inject, setSpeed },
    updateFromWs
  };
};

export default useStreamState;
