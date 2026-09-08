import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "./discovery-cards.scss";
import Icon from "../../../icon";

const REVEAL_MS = 2600;

type Discovery = "cat" | "frog" | "mermaid";
const discoveries = {
  mermaid: {
    name: "The Tidekeeper",
    number: "???",
    bonus: 0,
    hint: "A secret beneath the surface",
    label: "Mermaid awakened",
    note: "The water remembers her true form.",
    guide: "You broke the spell while the frog was in the pond.",
  },
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
        {kind === "mermaid" ? (
          "Secret arcana"
        ) : (
          <>
            +{card.bonus} <small>points</small>
          </>
        )}
      </span>
      <span className="garden-card__caption">{earned ? card.label : card.hint}</span>
      <span className="garden-card__seal">{earned ? "Discovered" : "Undiscovered"}</span>
    </div>
  );
}

export function DiscoveryCollection({
  catMet,
  frogFreed,
  mermaidAwakened = false,
}: {
  catMet: boolean;
  frogFreed: boolean;
  mermaidAwakened?: boolean;
}) {
  const [selected, setSelected] = useState<Discovery | null>(null);
  const count = Number(catMet) + Number(frogFreed) + Number(mermaidAwakened);
  const total = mermaidAwakened ? 3 : 2;
  const kinds: Discovery[] = mermaidAwakened ? ["cat", "frog", "mermaid"] : ["cat", "frog"];
  const selectedEarned =
    selected === "cat" ? catMet : selected === "mermaid" ? mermaidAwakened : frogFreed;
  return (
    <div className="garden-collection">
      <div className="garden-collection__heading">
        <span className="path-stones__eyebrow">Garden arcana</span>
        <span
          className="garden-collection__count"
          aria-label={`${count} of ${total} cards discovered`}
        >
          {count} / {total}
        </span>
      </div>
      <div className="garden-collection__cards">
        {kinds.map((kind) => {
          const earned = kind === "cat" ? catMet : kind === "mermaid" ? mermaidAwakened : frogFreed;
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
              {selected === "mermaid"
                ? "A hidden discovery. Your score and stone supply stay unchanged."
                : selectedEarned
                  ? `+${discoveries[selected].bonus} points included in your shrine score.`
                  : `Discover this friend to earn +${discoveries[selected].bonus} points.`}
            </small>
          </div>
        )}
      </div>
      <small className="garden-collection__pair" data-complete={catMet && frogFreed}>
        {catMet && frogFreed
          ? "Pair complete · +200 bonus points"
          : "Discover both for +200 bonus points"}
      </small>
    </div>
  );
}

export function DiscoveryReveal({
  catMet,
  frogFreed,
  mermaidAwakened = false,
  paused = false,
  onComplete,
}: {
  catMet: boolean;
  frogFreed: boolean;
  mermaidAwakened?: boolean;
  paused?: boolean;
  onComplete?: (kind: Discovery) => void;
}) {
  const [ready, setReady] = useState(!paused);
  useEffect(() => {
    setReady(false);
    if (paused) return;
    const timer = window.setTimeout(() => setReady(true), 1450);
    return () => window.clearTimeout(timer);
  }, [paused]);
  const seen = useRef({ cat: false, frog: false, mermaid: false });
  const [queue, setQueue] = useState<Discovery[]>([]);
  useEffect(() => {
    if (!catMet && !frogFreed && !mermaidAwakened) {
      seen.current = { cat: false, frog: false, mermaid: false };
      setQueue([]);
      return;
    }
    const earned: Discovery[] = [];
    if (catMet && !seen.current.cat) earned.push("cat");
    if (frogFreed && !seen.current.frog) earned.push("frog");
    if (mermaidAwakened && !seen.current.mermaid) earned.push("mermaid");
    seen.current = { cat: catMet, frog: frogFreed, mermaid: mermaidAwakened };
    if (earned.length) setQueue((pending) => [...pending, ...earned]);
  }, [catMet, frogFreed, mermaidAwakened]);
  const active = queue[0];
  useEffect(() => {
    if (!active || !ready || paused) return;
    const timer = window.setTimeout(() => {
      setQueue((pending) => pending.slice(1));
      onComplete?.(active);
    }, REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [active, ready, paused, onComplete]);
  if (!active || !ready || paused) return null;
  return (
    <div
      className="garden-discovery"
      key={active}
      role="status"
      aria-live="polite"
      style={{ "--discovery-duration": `${REVEAL_MS}ms` } as CSSProperties}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <span className="garden-discovery__kicker">
        {active === "mermaid" ? "A secret awakens" : "A new friendship"}
      </span>
      <div className="garden-discovery__burst" aria-hidden="true" />
      <DiscoveryCard kind={active} earned />
      <span className="garden-discovery__note">{discoveries[active].note}</span>
    </div>
  );
}
