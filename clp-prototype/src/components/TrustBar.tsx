import type { ConditionData } from "../data/conditions";

export default function TrustBar({ data }: { data: ConditionData }) {
  const { trustBar } = data;
  const items = [
    { icon: "👥", text: trustBar.memberCount },
    { icon: "📊", text: trustBar.primaryStat },
    { icon: "⭐", text: trustBar.rating },
  ];

  return (
    <section className="trust-bar fade-section">
      {items.map((item) => (
        <div className="trust-bar__item" key={item.text}>
          <div className="trust-bar__icon">{item.icon}</div>
          <span>{item.text}</span>
        </div>
      ))}
    </section>
  );
}
