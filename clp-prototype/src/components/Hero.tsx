import type { ConditionData } from "../data/conditions";

export default function Hero({ data }: { data: ConditionData }) {
  const { hero } = data;
  return (
    <section className="hero fade-section">
      <img
        className="hero__image"
        src={hero.image}
        alt={`Person finding relief from ${data.label.toLowerCase()}`}
      />
      <div className="hero__content">
        <div className="hero__badge">✓ $0 cost with your benefits</div>
        <h1 className="hero__headline">{hero.headline}</h1>
        <p className="hero__subhead">{hero.subhead}</p>
        <button className="btn btn--primary-large">{hero.ctaText}</button>
        <p className="hero__trust-line">{hero.trustLine}</p>
      </div>
    </section>
  );
}
