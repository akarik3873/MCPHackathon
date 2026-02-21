import { useState, useCallback } from 'react';
import { estimateCost, startAnalysis } from '../services/api';

export function useAnalysis() {
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [numCalls, setNumCalls] = useState(10);
  const [estimate, setEstimate] = useState(null);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState({ yes: 0, no: 0 });
  const [status, setStatus] = useState('idle'); // idle | estimating | estimated | analyzing | complete
  const [error, setError] = useState(null);

  const getEstimate = useCallback(async () => {
    if (!file) return;
    setStatus('estimating');
    setError(null);
    try {
      const est = await estimateCost(file, numCalls);
      setEstimate(est);
      setStatus('estimated');
    } catch (e) {
      setError(e.message);
      setStatus('idle');
    }
  }, [file, numCalls]);

  const runAnalysis = useCallback(
    async (userId) => {
      if (!file || !prompt) return;
      setStatus('analyzing');
      setResults([]);
      setSummary({ yes: 0, no: 0 });
      setError(null);

      try {
        await startAnalysis(file, prompt, numCalls, userId, (eventType, data) => {
          if (eventType === 'result') {
            setResults((prev) => [...prev, data]);
            setSummary((prev) => ({
              ...prev,
              [data.answer]: (prev[data.answer] || 0) + 1,
            }));
          } else if (eventType === 'complete') {
            setStatus('complete');
          }
        });
      } catch (e) {
        setError(e.message);
        setStatus('idle');
      }
    },
    [file, prompt, numCalls]
  );

  const reset = useCallback(() => {
    setFile(null);
    setPrompt('');
    setNumCalls(10);
    setEstimate(null);
    setResults([]);
    setSummary({ yes: 0, no: 0 });
    setStatus('idle');
    setError(null);
  }, []);

  return {
    file,
    setFile,
    prompt,
    setPrompt,
    numCalls,
    setNumCalls,
    estimate,
    results,
    summary,
    status,
    error,
    getEstimate,
    runAnalysis,
    reset,
  };
}
