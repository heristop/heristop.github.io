import { useEffect, useRef, useState } from "react";
import "./discovery-cards.scss";
import Icon from "../../../icon";

type Discovery = "cat" | "frog";
const discoveries = {
  cat: {
    name: "The Familiar",
    number: "01",
    bonus: 150,
    hint: "Befriend the cat",
    label: "Cat befriended",
    note: "A little trust. A loyal friend.",
    guide: "Walk next to the wandering cat. Let your paths cross.",
  },
  frog: {
    name: "The Enchanted",
    number: "02",
    bonus: 250,
    hint: "Break the frog’s spell",
    label: "Frog freed",
    note: "One kind act breaks the spell.",
    guide:
      "Find the frog by the water and walk next to it to break the spell. It also gives you 2 stones to lay.",
  },
} as const;

export function DiscoveryCard({ kind, earned }: { kind: Discovery; earned: boolean }) {
  const card = discoveries[kind];
  return (
    <div className="garden-card" data-kind={kind} data-earned={earned}>
      <div className="garden-card__top">
        <span>Garden arcana</span>
        <span>{card.number}</span>
      </div>
      <div className="garden-card__art" aria-hidden="true">
        <span className="garden-card__moon" />
        <span className="garden-card__star garden-card__star--one">✦</span>
        <span className="garden-card__star garden-card__star--two">✦</span>
        <span className="garden-card__sprite" />
        <span className="garden-card__ground" />
      </div>
      <strong className="garden-card__name">{card.name}</strong>
      <span className="garden-card__reward">
        +{card.bonus} <small>points</small>
      </span>
      <span className="garden-card__caption">{earned ? card.label : card.hint}</span>
      <span className="garden-card__seal">{earned ? "Discovered" : "Undiscovered"}</span>
    </div>
  );
}

export function DiscoveryCollection({
  catMet,
  frogFreed,
}: {
  catMet: boolean;
  frogFreed: boolean;
}) {
  const [selected, setSelected] = useState<Discovery | null>(null);
  const count = Number(catMet) + Number(frogFreed);
  const selectedEarned = selected === "cat" ? catMet : frogFreed;
  return (
    <div className="garden-collection">
      <div className="garden-collection__heading">
        <span className="path-stones__eyebrow">Garden arcana</span>
        <span className="garden-collection__count" aria-label={`${count} of 2 cards discovered`}>
          {count} / 2
        </span>
      </div>
      <div className="garden-collection__cards">
        {(["cat", "frog"] as const).map((kind) => {
          const earned = kind === "cat" ? catMet : frogFreed;
          return (
            <div className="garden-collection__slot" key={kind} data-selected={selected === kind}>
              <DiscoveryCard kind={kind} earned={earned} />
              <button
                type="button"
                className="garden-collection__inspect"
                aria-expanded={selected === kind}
                aria-controls="garden-card-details"
                aria-label={`${earned ? "Inspect" : "How to discover"} ${discoveries[kind].name}`}
                onClick={() => setSelected(selected === kind ? null : kind)}
              >
                {selected === kind ? "Close details" : earned ? "Inspect card" : "How to discover"}
                <Icon name="arrow-down" size={13} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      <div id="garden-card-details" hidden={!selected} className="garden-collection__details">
        {selected && (
          <div key={selected}>
            <strong>{discoveries[selected].name}</strong>
            <p>{selectedEarned ? discoveries[selected].note : discoveries[selected].guide}</p>
            <small>
              {selectedEarned
                ? `+${discoveries[selected].bonus} points included in your shrine score.`
                : `Discover this friend to earn +${discoveries[selected].bonus} points.`}
            </small>
          </div>
        )}
      </div>
      <small className="garden-collection__pair" data-complete={count === 2}>
        {count === 2 ? "Pair complete · +200 bonus points" : "Discover both for +200 bonus points"}
      </small>
    </div>
  );
}

export function DiscoveryReveal({
  catMet,
  frogFreed,
  paused = false,
}: {
  catMet: boolean;
  frogFreed: boolean;
  paused?: boolean;
}) {
  const [ready, setReady] = useState(!paused);
  useEffect(() => {
    setReady(false);
    if (paused) return;
    const timer = window.setTimeout(() => setReady(true), 1450);
    return () => window.clearTimeout(timer);
  }, [paused]);
  const seen = useRef({ cat: false, frog: false });
  const [queue, setQueue] = useState<Discovery[]>([]);
  useEffect(() => {
    if (!catMet && !frogFreed) {
      seen.current = { cat: false, frog: false };
      setQueue([]);
      return;
    }
    const earned: Discovery[] = [];
    if (catMet && !seen.current.cat) earned.push("cat");
    if (frogFreed && !seen.current.frog) earned.push("frog");
    seen.current = { cat: catMet, frog: frogFreed };
    if (earned.length) setQueue((pending) => [...pending, ...earned]);
  }, [catMet, frogFreed]);
  const active = queue[0];
  useEffect(() => {
    if (!active || !ready || paused) return;
    const timer = window.setTimeout(() => setQueue((pending) => pending.slice(1)), 3600);
    return () => window.clearTimeout(timer);
  }, [active, ready, paused]);
  if (!active || !ready || paused) return null;
  return (
    <div className="garden-discovery" key={active} role="status" aria-live="polite">
      <span className="garden-discovery__kicker">A new friendship</span>
      <div className="garden-discovery__burst" aria-hidden="true" />
      <DiscoveryCard kind={active} earned />
      <span className="garden-discovery__note">{discoveries[active].note}</span>
    </div>
  );
}
