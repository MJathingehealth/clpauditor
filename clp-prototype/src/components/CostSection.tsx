export default function CostSection() {
  return (
    <section className="section fade-section">
      <h2 className="section__title">Covered by your employer</h2>
      <div className="cost-comparison">
        <div className="cost-row">
          <span className="cost-row__label">Physical therapy visits</span>
          <span className="cost-row__value cost-row__value--regular">
            $50–75/session
          </span>
        </div>
        <div className="cost-row cost-row--highlight">
          <span className="cost-row__label">Hinge Health</span>
          <span className="cost-row__value cost-row__value--free">
            ✓ $0
          </span>
        </div>
      </div>
      <button
        className="btn btn--primary-large"
        style={{ marginTop: "var(--space-4)" }}
      >
        Check My Eligibility
      </button>
    </section>
  );
}
