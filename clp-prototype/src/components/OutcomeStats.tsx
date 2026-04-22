import type { ConditionData } from "../data/conditions";

export default function OutcomeStats({ data }: { data: ConditionData }) {
  const { outcomes } = data;
  return (
    <section className="section fade-section">
      <h2 className="section__title">{outcomes.title}</h2>
      <div className="stat-cards">
        {outcomes.stats.map((stat, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-card__value">{stat.value}</div>
            <div className="stat-card__desc">{stat.description}</div>
          </div>
        ))}
      </div>
      <p className="stat-citation">{outcomes.citation}</p>
    </section>
  );
}
