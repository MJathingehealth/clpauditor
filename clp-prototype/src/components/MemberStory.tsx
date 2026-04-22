import type { ConditionData } from "../data/conditions";

export default function MemberStory({ data }: { data: ConditionData }) {
  const { story } = data;
  return (
    <section className="section section--alt fade-section">
      <h2 className="section__title">{story.title}</h2>
      <div className="story-card">
        <div className="story-card__header">
          <img
            className="story-card__avatar"
            src={story.image}
            alt={story.name}
          />
          <div>
            <div className="story-card__name">{story.name}</div>
            <div className="story-card__condition">{story.condition}</div>
          </div>
        </div>
        <p className="story-card__quote">"{story.quote}"</p>
      </div>
    </section>
  );
}
