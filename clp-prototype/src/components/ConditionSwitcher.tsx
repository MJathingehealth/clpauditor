import { CONDITIONS, CONDITION_ORDER } from "../data/conditions";
import type { ConditionKey } from "../data/conditions";

interface Props {
  active: ConditionKey;
  onChange: (key: ConditionKey) => void;
}

export default function ConditionSwitcher({ active, onChange }: Props) {
  return (
    <div className="switcher">
      <span className="switcher__label">Condition:</span>
      {CONDITION_ORDER.map((key) => (
        <button
          key={key}
          className={`switcher__btn ${key === active ? "switcher__btn--active" : ""}`}
          onClick={() => onChange(key)}
        >
          {CONDITIONS[key].label}
        </button>
      ))}
    </div>
  );
}
