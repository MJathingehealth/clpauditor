import type { ConditionData } from "../data/conditions";

export default function HowItWorks({ data }: { data: ConditionData }) {
  const { howItWorks } = data;
  return (
    <section className="section section--alt fade-section">
      <h2 className="section__title">{howItWorks.title}</h2>
      <div className="steps">
        {howItWorks.steps.map((step, i) => (
          <div className="step" key={i}>
            <div className="step__icon">{step.icon}</div>
            <div className="step__content">
              <div className="step__title">{step.title}</div>
              <div className="step__desc">{step.description}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
