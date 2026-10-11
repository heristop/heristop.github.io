import React, { useCallback, useEffect, useRef, useState } from "react";

const BLINK_DURATION = 200;

export default function BuyMeCoffee({ url }: { url: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const blinkTimerRef = useRef<number | null>(null);

  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [eyesBlink, setEyesBlink] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const cupTiltX = mouseX * 3;
  const cupTiltY = mouseY * 2;

  const updateCoordinates = useCallback((x: number, y: number) => {
    const el = contentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = Math.max(-1, Math.min(1, (2 * (x - rect.left)) / rect.width - 1));
    const relY = Math.max(-1, Math.min(1, (2 * (y - rect.top)) / rect.height - 1));
    setMouseX(relX);
    setMouseY(relY);
  }, []);

  const scheduleNextBlink = useCallback(() => {
    const next = 2000 + Math.random() * 4000;
    if (blinkTimerRef.current !== null) clearTimeout(blinkTimerRef.current);
    blinkTimerRef.current = window.setTimeout(() => {
      setEyesBlink(true);
      setTimeout(() => setEyesBlink(false), BLINK_DURATION);
      scheduleNextBlink();
    }, next);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHasLoaded(true), 500);
    scheduleNextBlink();
    return () => {
      clearTimeout(t);
      if (blinkTimerRef.current !== null) clearTimeout(blinkTimerRef.current);
    };
  }, [scheduleNextBlink]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateCoordinates(e.clientX, e.clientY);
    },
    [updateCoordinates],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      const touch = e.touches[0];
      if (touch) updateCoordinates(touch.clientX, touch.clientY);
    },
    [updateCoordinates],
  );

  const onMouseEnter = useCallback(() => setIsHovering(true), []);
  const onMouseLeave = useCallback(() => {
    setIsHovering(false);
    setMouseX(0);
    setMouseY(0);
  }, []);

  const steamStyle = { "--attract-x": mouseX, "--attract-y": mouseY } as React.CSSProperties;

  /* Colours, motion and themes live in src/styles/_coffee.scss; the SVG only names its parts.
     The link is named by its visible text; new-tab-links adds the "opens in a new tab" hint. */
  return (
    <div className="bmc">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="bmc__link"
        data-tooltip="buymeacoffee.com · new tab"
        data-tooltip-placement="top"
      >
        <div
          ref={contentRef}
          className={`bmc__content${isHovering ? " bmc__content--hover" : ""}`}
          onMouseMove={onMouseMove}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onTouchMove={onTouchMove}
        >
          <div className="bmc__shadow" />

          <div
            className={`bmc__cup${hasLoaded ? " bmc__cup--loaded" : ""}`}
            style={{
              "--tilt-x": `${cupTiltX}deg`,
              "--tilt-y": `${cupTiltY}deg`,
            } as React.CSSProperties}
          >
            <svg
              className="bmc__icon"
              aria-hidden="true"
              focusable="false"
              width="66"
              height="66"
              viewBox="0 0 100 100"
              fill="none"
            >
              <defs>
                <clipPath id="bmc-cup-clip">
                  <path d="M27 37H73V65C73 71.075 68.075 76 62 76H38C31.925 76 27 71.075 27 65V37Z" />
                </clipPath>
                {/* A faint wobble so the ink reads as brushwork rather than vector lines */}
                <filter id="bmc-brush" x="-10%" y="-10%" width="120%" height="120%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7" />
                  <feDisplacementMap in="SourceGraphic" scale="1.8" />
                </filter>
              </defs>

              <g filter="url(#bmc-brush)">

              {/* Cup body */}
              <path
                className="bmc__ceramic"
                d="M25 35H75V65C75 72.18 69.18 78 62 78H38C30.82 78 25 72.18 25 65V35Z"
              />

              {/* Coffee */}
              <g clipPath="url(#bmc-cup-clip)">
                <rect className="bmc__coffee" x="25" y="42" width="50" height="40" />
                <path
                  className="bmc__wave bmc__wave--1 bmc__crema"
                  d="M20 44 Q32 40, 50 44 Q68 48, 80 44 V48 Q65 51, 50 48 Q35 45, 20 48 Z"
                />
                <path
                  className="bmc__wave bmc__wave--2 bmc__coffee-deep"
                  d="M20 58 Q35 62, 50 58 Q65 54, 80 58 V80 H20 Z"
                />
              </g>

              {/* Hand-drawn outline: a brush line, slightly heavier on the shaded side */}
              <path
                className="bmc__line"
                d="M25 35H75V65C75 72.18 69.18 78 62 78H38C30.82 78 25 72.18 25 65V35Z"
                strokeWidth="3.5"
              />
              <path className="bmc__rim" d="M28.5 36.5H71.5" strokeWidth="1.6" />

              {/* Handle */}
              <path
                className="bmc__line"
                d="M75 45H84C87.87 45 91 48.13 91 52V56C91 59.87 87.87 63 84 63H75"
                strokeWidth="3.5"
              />

              {/* Blush */}
              <ellipse className="bmc__blush" cx="33" cy="60" rx="4.5" ry="2.6" />
              <ellipse className="bmc__blush" cx="67" cy="60" rx="4.5" ry="2.6" />

              {/* Eyes */}
              {!eyesBlink ? (
                <g>
                  <ellipse className="bmc__eye" cx="40" cy="52" rx="5.5" ry="6" />
                  <ellipse className="bmc__eye" cx="60" cy="52" rx="5.5" ry="6" />
                  <circle className="bmc__pupil" cx={40 + mouseX * 2} cy={52 + mouseY * 1.5} r="3.2" />
                  <circle className="bmc__pupil" cx={60 + mouseX * 2} cy={52 + mouseY * 1.5} r="3.2" />
                  <circle className="bmc__glint" cx={41.4 + mouseX * 1.2} cy={50.6 + mouseY * 0.8} r="1.1" />
                  <circle className="bmc__glint" cx={61.4 + mouseX * 1.2} cy={50.6 + mouseY * 0.8} r="1.1" />
                </g>
              ) : (
                <g>
                  <path className="bmc__line" d="M35 52 Q40 48.5, 45 52" strokeWidth="2.2" />
                  <path className="bmc__line" d="M55 52 Q60 48.5, 65 52" strokeWidth="2.2" />
                </g>
              )}

              {/* Smile */}
              <path
                className="bmc__line"
                d={`M43 64 Q${50 + mouseX * 4} ${68 + mouseY * 2}, 57 64`}
                strokeWidth="2.2"
              />
              </g>
            </svg>

            {/* Steam: three rose brush strokes */}
            <svg className="bmc__steam" viewBox="0 0 40 50" fill="none" aria-hidden="true" focusable="false">
              <path
                className="bmc__steam-path bmc__steam-path--1"
                d="M12 48 Q8 38, 14 30 Q20 22, 15 12 Q12 6, 14 0"
                style={steamStyle}
                strokeWidth="2.2"
              />
              <path
                className="bmc__steam-path bmc__steam-path--2"
                d="M20 48 Q24 40, 19 32 Q14 24, 20 16 Q24 10, 21 2"
                style={steamStyle}
                strokeWidth="1.6"
              />
              <path
                className="bmc__steam-path bmc__steam-path--3"
                d="M28 48 Q32 38, 26 28 Q20 18, 27 8 Q30 2, 27 0"
                style={steamStyle}
                strokeWidth="1.9"
              />
            </svg>
          </div>
        </div>

        <span className="bmc__text">
          <span className="bmc__label">Buy me a coffee</span>{" "}
          <span className="bmc__hint">Support my writing</span>
        </span>
      </a>
    </div>
  );
}
