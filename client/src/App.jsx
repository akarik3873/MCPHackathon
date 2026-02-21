import { useState, useEffect } from 'react';
import { supabase } from './services/supabase';
import { useAnalysis } from './hooks/useAnalysis';
import LoginButton from './components/LoginButton';
import FileUpload from './components/FileUpload';
import AnalysisForm from './components/AnalysisForm';
import CostEstimate from './components/CostEstimate';
import ProgressDisplay from './components/ProgressDisplay';
import ResultsChart from './components/ResultsChart';

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [fundAmount, setFundAmount] = useState(5);
  const [loadingFunds, setLoadingFunds] = useState(false);

  const {
    file, setFile,
    prompt, setPrompt,
    numCalls, setNumCalls,
    estimate,
    results,
    summary,
    status,
    error,
    getEstimate,
    runAnalysis,
    reset,
  } = useAnalysis();

  // Auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch balance when user changes
  useEffect(() => {
    if (!user) {
      setBalance(null);
      return;
    }
    fetchBalance();
  }, [user]);

  // Detect return from Stripe checkout and poll for updated balance
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;

    // Clean up the URL
    window.history.replaceState({}, '', window.location.pathname);

    // Poll for balance update — webhook may take a moment
    let attempts = 0;
    const initialBalance = balance;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API_URL}/balance/${user.id}`);
        const data = await res.json();
        const newBal = data.balance;
        if (newBal !== initialBalance || attempts >= 10) {
          setBalance(newBal);
          clearInterval(poll);
        }
      } catch {
        if (attempts >= 10) clearInterval(poll);
      }
    }, 1500);

    return () => clearInterval(poll);
  }, [user]);

  const fetchBalance = async () => {
    try {
      const res = await fetch(`${API_URL}/balance/${user.id}`);
      const data = await res.json();
      setBalance(data.balance ?? 0);
    } catch {
      // Fallback to direct Supabase query
      const { data } = await supabase
        .from('balance')
        .select('balance')
        .eq('id', user.id)
        .single();
      setBalance(data ? parseFloat(data.balance) : 0);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    reset();
  };

  const handleAddFunds = async () => {
    setLoadingFunds(true);
    try {
      const response = await fetch(`${API_URL}/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          amount: Math.round(fundAmount * 100),
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to create checkout:', err);
    } finally {
      setLoadingFunds(false);
    }
  };

  const handleConfirmAnalysis = async () => {
    if (estimate && balance !== null && balance < estimate.total_cost) {
      alert('Insufficient balance. Please add funds.');
      return;
    }
    await runAnalysis(user.id);
    fetchBalance(); // refresh balance after analysis
  };

  // Not authenticated
  if (!user) {
    return (
      <div className="app">
        <div className="auth-gate">
          <h1>Pneuma</h1>
          <p>AI-powered multi-perspective analysis</p>
          <LoginButton />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pneuma</h1>
        <div className="header-right">
          <span className="balance">Balance: ${balance !== null ? balance.toFixed(4) : '...'}</span>
          <button className="add-funds-btn" onClick={() => setShowFundsModal(true)}>Add Funds</button>
          <span className="user-email">{user.email}</span>
          <button className="sign-out-btn" onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      <main className="app-main">
        {status === 'idle' && (
          <>
            <FileUpload onFileSelect={setFile} currentFile={file} />
            {file && (
              <AnalysisForm
                prompt={prompt}
                setPrompt={setPrompt}
                numCalls={numCalls}
                setNumCalls={setNumCalls}
                onSubmit={getEstimate}
                disabled={false}
              />
            )}
          </>
        )}

        {status === 'estimating' && <p className="status-msg">Estimating cost...</p>}

        {status === 'estimated' && (
          <CostEstimate
            estimate={estimate}
            onConfirm={handleConfirmAnalysis}
            onCancel={reset}
          />
        )}

        {(status === 'analyzing' || status === 'complete') && (
          <>
            <ProgressDisplay results={results} total={numCalls} />
            <ResultsChart summary={summary} />
            {status === 'complete' && (
              <button className="reset-btn" onClick={reset}>New Analysis</button>
            )}
          </>
        )}

        {error && <p className="error-msg">{error}</p>}
      </main>

      {showFundsModal && (
        <div className="modal-overlay" onClick={() => setShowFundsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Funds</h2>
            <div className="fund-options">
              {[1, 5, 10, 25].map((amt) => (
                <button
                  key={amt}
                  className={`fund-option ${fundAmount === amt ? 'selected' : ''}`}
                  onClick={() => setFundAmount(amt)}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <button
              className="confirm-btn"
              onClick={handleAddFunds}
              disabled={loadingFunds}
            >
              {loadingFunds ? 'Redirecting...' : `Pay $${fundAmount}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
