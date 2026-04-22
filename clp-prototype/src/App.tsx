import { useState, useRef, useEffect } from "react";
import "./styles.css";
import { CONDITIONS } from "./data/conditions";
import type { ConditionKey } from "./data/conditions";
import StickyNav from "./components/StickyNav";
import Hero from "./components/Hero";
import TrustBar from "./components/TrustBar";
import HowItWorks from "./components/HowItWorks";
import OutcomeStats from "./components/OutcomeStats";
import MemberStory from "./components/MemberStory";
import CostSection from "./components/CostSection";
import FinalCTA from "./components/FinalCTA";
import ConditionSwitcher from "./components/ConditionSwitcher";

export default function App() {
  const [condition, setCondition] = useState<ConditionKey>("back");
  const [animKey, setAnimKey] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);

  const data = CONDITIONS[condition];

  function handleConditionChange(key: ConditionKey) {
    if (key === condition) return;
    setCondition(key);
    setAnimKey((k) => k + 1);
    pageRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Reset scroll when condition changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [condition]);

  return (
    <>
      <div ref={pageRef} key={animKey}>
        <StickyNav />
        <main id="main">
          <Hero data={data} />
          <TrustBar data={data} />
          <HowItWorks data={data} />
          <OutcomeStats data={data} />
          <MemberStory data={data} />
          <CostSection />
          <FinalCTA data={data} />
        </main>
        <footer className="footer">
          <div className="footer__logo">Hinge Health</div>
          <div className="footer__links">
            <a href="#">Privacy</a> · <a href="#">Terms</a> ·{" "}
            <a href="#">Support</a>
          </div>
        </footer>
        <div className="page-bottom-pad" />
      </div>
      <ConditionSwitcher active={condition} onChange={handleConditionChange} />
    </>
  );
}
