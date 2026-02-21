export default function CostEstimate({ estimate, onConfirm, onCancel }) {
  if (!estimate) return null;

  return (
    <div className="cost-estimate">
      <h3>Cost Estimate</h3>
      <div className="cost-details">
        <p><strong>Input tokens per call:</strong> {estimate.input_tokens.toLocaleString()}</p>
        <p><strong>Number of calls:</strong> {estimate.num_calls}</p>
        <p><strong>Cost per call:</strong> ${estimate.cost_per_call.toFixed(6)}</p>
        <p className="total-cost"><strong>Total cost:</strong> {estimate.display_cost}</p>
      </div>
      <div className="cost-actions">
        <button className="confirm-btn" onClick={onConfirm}>Confirm & Run</button>
        <button className="cancel-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
