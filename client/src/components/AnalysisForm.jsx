export default function AnalysisForm({ prompt, setPrompt, numCalls, setNumCalls, onSubmit, disabled }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form className="analysis-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="prompt">Your yes/no question:</label>
        <input
          id="prompt"
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Would you support this policy?"
          required
          disabled={disabled}
        />
      </div>
      <div className="form-group">
        <label htmlFor="numCalls">Number of perspectives:</label>
        <input
          id="numCalls"
          type="number"
          value={numCalls}
          onChange={(e) => setNumCalls(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
          min={1}
          max={100}
          disabled={disabled}
        />
      </div>
      <button type="submit" disabled={disabled || !prompt}>
        Estimate Cost
      </button>
    </form>
  );
}
