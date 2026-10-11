import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Icon from "@zazencode/ui/icon";
import daily from "./haiku-daily";
import { NEW_TAB_HINT_ID } from "./new-tab-links";
import type { HaikuSource } from "./haiku-daily";

const { haikuDay, nextVerse } = daily;

const MINUTE_MS = 60_000;
const RIDDLE = "This composition borrows its spark from literature. Can you trace it back?";

// Server render has no "today": the date lands after mount, then ticks once a minute
const useNow = () => {
  const [now, setNow] = useState<Date | undefined>();
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => {
      setNow(new Date());
    }, MINUTE_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return now;
};

const Chevron = ({ className }: { className: string }) => (
  <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const HaikuEyebrow = ({ now }: { now: Date | undefined }) => {
  if (!now) {
    return <p className="haiku-card__eyebrow">Today’s verse</p>;
  }
  const day = haikuDay(now);
  return (
    <p className="haiku-card__eyebrow">
      <time dateTime={day.iso}>
        {day.weekday}
        <span className="haiku-card__eyebrow-dot" aria-hidden="true"> · </span>
        <span className="sr-only">, </span>
        {day.dayMonth}
      </time>
    </p>
  );
};

/* The reading rests at five lines and fades out; the toggle only exists when there is more */
const HaikuReading = ({ children, text }: { children: React.ReactNode; text: string | undefined }) => {
  const id = useId();
  const clampRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);

  useLayoutEffect(() => {
    const clamp = clampRef.current;
    const inner = clamp?.firstElementChild;
    if (!clamp || !(inner instanceof HTMLElement)) {
      return;
    }
    // Against the resting height (lines × line height), so an open reading keeps its toggle
    const measure = () => {
      const height = inner.offsetHeight;
      const lines = Number.parseFloat(getComputedStyle(clamp).getPropertyValue("--haiku-lines"));
      const lineHeight = Number.parseFloat(getComputedStyle(inner).lineHeight);
      const resting = lines * lineHeight;
      setFullHeight(height);
      setOverflows(Number.isFinite(resting) && resting > 0 ? height > resting + 1 : height > clamp.clientHeight + 1);
    };
    measure();
    if (typeof ResizeObserver !== "function") {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => {
      observer.disconnect();
    };
  }, [text]);

  const toggle = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  return (
    <div className="haiku-card__reading">
      <div
        id={id}
        ref={clampRef}
        className="haiku-card__clamp"
        data-open={open}
        data-overflows={overflows}
        style={{ "--haiku-full": `${fullHeight}px` } as React.CSSProperties}
      >
        {children}
      </div>
      {overflows && (
        <button type="button" className="haiku-card__more" aria-expanded={open} aria-controls={id} onClick={toggle}>
          {open ? "Show less" : "Read the whole reading"}
          <Chevron className="haiku-card__chevron" />
        </button>
      )}
    </div>
  );
};

const HaikuTrace = ({ source }: { source: HaikuSource }) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="haiku-card__trace"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        Trace the source
        <Chevron className="haiku-card__chevron" />
      </button>
      <div id={id} className="haiku-card__answer" data-open={open}>
        <div className="haiku-card__answer-inner">
          <p>
            Each line is lifted from a public-domain book.
            {source.bookmoji && (
              <>
                {" "}
                <span className="haiku-card__bookmoji" role="img" aria-label="Bookmoji hint">
                  {source.bookmoji}
                </span>
              </>
            )}
          </p>
          <p>
            Today’s verses come from <cite>{source.book}</cite>
            {source.author ? `, ${source.author}.` : "."}
          </p>
        </div>
      </div>
    </>
  );
};

/* The day's ring fills from one GutenKu rollover to the next */
const HaikuFoot = ({ now, source }: { now: Date | undefined; source: HaikuSource | undefined }) => {
  const next = now ? nextVerse(now) : undefined;
  return (
    <>
      <div className="haiku-card__foot">
        <span className="haiku-card__next">
          <span
            className="haiku-card__ring"
            aria-hidden="true"
            style={{ "--haiku-day": next?.progress ?? 0 } as React.CSSProperties}
          />
          {next?.label ?? "A new verse each day"}
        </span>
        {source?.book && (
          <>
            <span className="haiku-card__sep" aria-hidden="true" />
            <HaikuTrace source={source} />
          </>
        )}
        <span className="haiku-card__sep" aria-hidden="true" />
        <a
          className="haiku-card__link"
          href="https://gutenku.xyz"
          target="_blank"
          rel="noopener noreferrer"
          aria-describedby={NEW_TAB_HINT_ID}
        >
          GutenKu
          <Icon name="arrow-up-right" size={13} strokeWidth={2} />
        </a>
      </div>
      {!source?.book && <p className="haiku-card__riddle">{RIDDLE}</p>}
    </>
  );
};

export { HaikuEyebrow, HaikuFoot, HaikuReading, useNow };
