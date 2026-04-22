import type { ConditionData } from "../data/conditions";

export default function FinalCTA({ data }: { data: ConditionData }) {
  const { finalCta } = data;
  return (
    <section className="final-cta fade-section">
      <h2 className="final-cta__headline">{finalCta.headline}</h2>
      <button className="btn btn--primary-large">{finalCta.ctaText}</button>
      <p className="final-cta__trust">{finalCta.trustLine}</p>
    </section>
  );
}
