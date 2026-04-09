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

  return (
    <div className="bmc">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy me a coffee"
        className="bmc__link"
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
            {/* Coffee cup SVG */}
            <svg
              className="bmc__icon"
              role="img"
              aria-label="Buy me a coffee"
              width="60"
              height="60"
              viewBox="0 0 100 100"
              fill="none"
            >
              <defs>
                <clipPath id="bmc-cup-clip">
                  <path d="M27 37H73V65C73 71.075 68.075 76 62 76H38C31.925 76 27 71.075 27 65V37Z" />
                </clipPath>
              </defs>

              {/* Cup body */}
              <path
                d="M25 35H75V65C75 72.18 69.18 78 62 78H38C30.82 78 25 72.18 25 65V35Z"
                fill="#FDFAF5"
                stroke="#5D3E28"
                strokeWidth="4"
                strokeLinejoin="round"
              />

              {/* Coffee liquid */}
              <g clipPath="url(#bmc-cup-clip)">
                <rect x="25" y="42" width="50" height="40" fill="#8B5E3C" />
                <rect x="25" y="42" width="50" height="8" fill="#A0714F" opacity="0.6" />
                <path
                  className="bmc__wave bmc__wave--1"
                  d="M20 44 Q32 40, 50 44 Q68 48, 80 44 V80 H20 Z"
                  fill="#6F4E37"
                />
                <path
                  className="bmc__wave bmc__wave--2"
                  d="M20 45 Q35 49, 50 45 Q65 41, 80 45 V80 H20 Z"
                  fill="#5D3E28"
                  opacity="0.4"
                />
                <ellipse
                  cx="42"
                  cy="46"
                  rx="8"
                  ry="2"
                  fill="#A0714F"
                  opacity="0.3"
                  className="bmc__shine"
                />
              </g>

              {/* Cup outline overlay */}
              <path
                d="M25 35H75V65C75 72.18 69.18 78 62 78H38C30.82 78 25 72.18 25 65V35Z"
                fill="none"
                stroke="#5D3E28"
                strokeWidth="4"
                strokeLinejoin="round"
              />

              {/* Rim highlight */}
              <path
                d="M27 35H73"
                stroke="#E8DDD0"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.6"
              />

              {/* Handle */}
              <path
                d="M75 45H84C87.87 45 91 48.13 91 52V56C91 59.87 87.87 63 84 63H75"
                stroke="#5D3E28"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M76 48H83C85.2 48 87 49.8 87 52V56C87 58.2 85.2 60 83 60H76"
                stroke="#E8DDD0"
                strokeWidth="1"
                strokeLinecap="round"
                fill="none"
                opacity="0.4"
              />

              {/* Blush */}
              <ellipse
                cx="33"
                cy="58"
                rx="5"
                ry="3"
                fill="#E8A0A0"
                opacity={isHovering ? 0.5 : 0.2}
              />
              <ellipse
                cx="67"
                cy="58"
                rx="5"
                ry="3"
                fill="#E8A0A0"
                opacity={isHovering ? 0.5 : 0.2}
              />

              {/* Eyes */}
              <g>
                <ellipse cx="40" cy="52" rx="6" ry="6.5" fill="white" stroke="#5D3E28" strokeWidth="1.5" />
                <ellipse cx="60" cy="52" rx="6" ry="6.5" fill="white" stroke="#5D3E28" strokeWidth="1.5" />

                {!eyesBlink ? (
                  <>
                    <circle cx={40 + mouseX * 2} cy={52 + mouseY * 1.5} r="3.5" fill="#3D2B1F" />
                    <circle cx={60 + mouseX * 2} cy={52 + mouseY * 1.5} r="3.5" fill="#3D2B1F" />
                    <circle cx={41.5 + mouseX * 1.2} cy={50.5 + mouseY * 0.8} r="1.2" fill="white" opacity="0.9" />
                    <circle cx={61.5 + mouseX * 1.2} cy={50.5 + mouseY * 0.8} r="1.2" fill="white" opacity="0.9" />
                  </>
                ) : (
                  <>
                    <path d="M34 52 Q40 48, 46 52" stroke="#5D3E28" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <path d="M54 52 Q60 48, 66 52" stroke="#5D3E28" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </>
                )}
              </g>

              {/* Smile */}
              <path
                d={`M42 64 Q${50 + mouseX * 4} ${68 + mouseY * 2}, 58 64`}
                stroke="#5D3E28"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            {/* Steam */}
            <svg className="bmc__steam" viewBox="0 0 40 50" fill="none">
              <path
                className="bmc__steam-path bmc__steam-path--1"
                d="M12 48 Q8 38, 14 30 Q20 22, 15 12 Q12 6, 14 0"
                style={{ "--attract-x": mouseX, "--attract-y": mouseY } as React.CSSProperties}
                stroke="#8B7355"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                opacity="0"
              />
              <path
                className="bmc__steam-path bmc__steam-path--2"
                d="M20 48 Q24 40, 19 32 Q14 24, 20 16 Q24 10, 21 2"
                style={{ "--attract-x": mouseX, "--attract-y": mouseY } as React.CSSProperties}
                stroke="#8B7355"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
                opacity="0"
              />
              <path
                className="bmc__steam-path bmc__steam-path--3"
                d="M28 48 Q32 38, 26 28 Q20 18, 27 8 Q30 2, 27 0"
                style={{ "--attract-x": mouseX, "--attract-y": mouseY } as React.CSSProperties}
                stroke="#8B7355"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
                opacity="0"
              />
            </svg>
          </div>
        </div>

        <span className="bmc__label">Buy me a coffee</span>
      </a>

      <style>{`
        .bmc {
          display: flex;
          justify-content: center;
          margin: 1.5rem auto 0;
        }

        .bmc__link {
          text-decoration: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
        }

        .bmc__content {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 7.5rem;
          width: 7.5rem;
          background: linear-gradient(180deg, #fff8ee 0%, #fff2dc 100%);
          overflow: hidden;
          padding-top: 0.75rem;
          touch-action: none;
          transition: background 0.4s ease;
          border-radius: 50%;
        }

        .bmc__content--hover {
          background: linear-gradient(180deg, #fff5e6 0%, #ffedcc 100%);
        }

        .bmc__shadow {
          position: absolute;
          height: 0.25rem;
          border-radius: 50%;
          background: oklch(42% 0.07 55 / 0.18);
          bottom: 1.25rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 0;
          animation: bmc-shadow 3s ease-in-out infinite;
        }

        .bmc__cup {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 4rem;
          height: 4rem;
          transform: scale(0.9) rotate(-3deg);
          transform-origin: center center;
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          animation: bmc-float 3s ease-in-out infinite;
          filter: drop-shadow(0 0.25rem 0.4rem oklch(0% 0 0 / 0.1));
          z-index: 1;
        }

        .bmc__cup--loaded {
          transform: scale(1) rotate(-3deg) rotateX(var(--tilt-y, 0deg)) rotateY(var(--tilt-x, 0deg));
        }

        .bmc__icon {
          position: relative;
          z-index: 1;
        }

        .bmc__icon circle,
        .bmc__icon ellipse,
        .bmc__icon path {
          transition: all 0.15s ease;
        }

        .bmc__wave--1 {
          animation: bmc-wave1 2.5s ease-in-out infinite;
        }

        .bmc__wave--2 {
          animation: bmc-wave2 3s ease-in-out infinite;
        }

        .bmc__shine {
          animation: bmc-shine 3s ease-in-out infinite;
        }

        .bmc__steam {
          position: absolute;
          top: -1.5rem;
          left: 50%;
          transform: translateX(-50%);
          width: 2.5rem;
          height: 3rem;
          overflow: visible;
        }

        .bmc__steam-path {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          filter: blur(0.5px);
        }

        .bmc__steam-path--1 {
          animation: bmc-steam 3s ease-in-out infinite;
        }

        .bmc__steam-path--2 {
          animation: bmc-steam 3s ease-in-out 0.6s infinite;
        }

        .bmc__steam-path--3 {
          animation: bmc-steam 3s ease-in-out 1.2s infinite;
        }

        .bmc__label {
          color: var(--text-secondary, #5d3e28);
          font-size: 0.85rem;
          font-weight: 600;
          opacity: 0.8;
          transition: opacity 0.3s ease;
        }

        .bmc__link:hover .bmc__label {
          opacity: 1;
        }

        @keyframes bmc-float {
          0%, 100% {
            transform: translateY(0) rotate(-3deg) rotateX(var(--tilt-y, 0deg)) rotateY(var(--tilt-x, 0deg));
          }
          50% {
            transform: translateY(-0.15rem) rotate(-3deg) rotateX(var(--tilt-y, 0deg)) rotateY(var(--tilt-x, 0deg));
          }
        }

        @keyframes bmc-shadow {
          0%, 100% { width: 2rem; opacity: 0.18; }
          50% { width: 1.6rem; opacity: 0.12; }
        }

        @keyframes bmc-wave1 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(3px); }
        }

        @keyframes bmc-wave2 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-2px); }
        }

        @keyframes bmc-shine {
          0%, 100% { opacity: 0.3; transform: translateX(0); }
          50% { opacity: 0.15; transform: translateX(3px); }
        }

        @keyframes bmc-steam {
          0% {
            stroke-dashoffset: 60;
            opacity: 0;
            transform: translateX(0) translateY(0);
          }
          15% { opacity: 0.35; }
          50% {
            stroke-dashoffset: 0;
            opacity: 0.25;
            transform: translateX(calc(var(--attract-x, 0) * 4px)) translateY(calc(var(--attract-y, 0) * -3px));
          }
          85% { opacity: 0.1; }
          100% {
            stroke-dashoffset: -60;
            opacity: 0;
            transform: translateX(calc(var(--attract-x, 0) * 6px)) translateY(-4px);
          }
        }

        @media (max-width: 48em) {
          .bmc__content {
            height: 6.25rem;
            width: 6.25rem;
          }

          .bmc__cup {
            transform: scale(0.8) rotate(-3deg);
          }

          .bmc__cup--loaded {
            transform: scale(0.9) rotate(-3deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bmc__wave,
          .bmc__shine,
          .bmc__steam-path,
          .bmc__cup,
          .bmc__shadow {
            animation: none;
          }

          .bmc__steam-path {
            stroke-dashoffset: 0;
            opacity: 0.2;
          }
        }
      `}</style>
    </div>
  );
}
