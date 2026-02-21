export default function ProgressDisplay({ results, total }) {
  const cards = [];
  for (let i = 0; i < total; i++) {
    const result = results[i];
    cards.push(
      <div key={i} className={`result-card ${result ? result.answer : 'pending'}`} title={result ? result.explanation : ''}>
        {result ? (
          <span className="result-answer">{result.answer === 'yes' ? 'Y' : 'N'}</span>
        ) : (
          <span className="result-pending">...</span>
        )}
      </div>
    );
  }

  return (
    <div className="progress-display">
      <h3>Results ({results.length} / {total})</h3>
      <div className="results-grid">{cards}</div>
    </div>
  );
}
