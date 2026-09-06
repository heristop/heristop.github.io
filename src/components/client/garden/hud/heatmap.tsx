import type { CSSProperties } from "react";
import type { GardenDay } from "../../../../data/garden-schema";
import { formatDate } from "./day-card";

interface Props {
  days: readonly (GardenDay | null)[];
  pilgrimDay: number | undefined;
  inspectDay: number | undefined;
  focusDay: number | undefined;
  stoneDays: ReadonlySet<number>;
  shrineDay: number;
  onHoverDay: (dayIndex: number | undefined) => void;
  onSelectDay: (dayIndex: number) => void;
}

// The same four-step ramp the garden's ground uses. The chart and the board have to
// agree, or the heatmap stops being a key to the thing you are walking on.
const levelForCount = (count: number): number => {
  if (count <= 0) {
    return 0;
  }
  if (count <= 3) {
    return 1;
  }
  if (count <= 8) {
    return 2;
  }
  return 3;
};

// Sunday-first weekday, read straight off the ISO date rather than from the index, so a
// window that does not start on a Sunday still labels correctly.
const weekdayOf = (iso: string): number => {
  const [year, month, day] = iso.split("-").map((part) => Number.parseInt(part, 10));
  if ([year, month, day].some(Number.isNaN)) {
    return 0;
  }
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

const describe = (day: GardenDay): string =>
  `${formatDate(day.date)} · ${day.count === 0 ? "no commits" : `${day.count} commit${day.count === 1 ? "" : "s"}`}`;

const ZazenHeatmap = ({
  days,
  pilgrimDay,
  inspectDay,
  focusDay,
  stoneDays,
  shrineDay,
  onHoverDay,
  onSelectDay,
}: Props) => {
  const focused = focusDay === undefined ? undefined : days[focusDay];

  return (
    <section
      className="path-stones__heat"
      aria-labelledby="path-stones-heat-title"
      style={{ "--heat-columns": days.length } as CSSProperties}
    >
      <header className="path-stones__heat-head">
        <h2 className="path-stones__heat-title" id="path-stones-heat-title">
          The last {days.length} days
        </h2>
        <p className="path-stones__heat-readout">{focused ? describe(focused) : " "}</p>
      </header>

      {/* A fortnight is a row, not a calendar. Laid out as weeks, fourteen days is two
          columns of squares with five empty rows around them — the grid was only ever
          worth its complexity when there were a hundred of them. */}
      <ol className="path-stones__heat-strip">
        {days.map((day, index) => {
          const count = day?.count ?? 0;
          const classes = [
            "path-stones__heat-cell",
            `path-stones__heat-cell--l${levelForCount(count)}`,
          ];
          if (stoneDays.has(index)) {
            classes.push("path-stones__heat-cell--stone");
          }
          if (index === shrineDay) {
            classes.push("path-stones__heat-cell--shrine");
          }
          if (index === pilgrimDay) {
            classes.push("path-stones__heat-cell--here");
          }
          if (index === inspectDay) {
            classes.push("path-stones__heat-cell--inspected");
          }
          const label = day
            ? `${formatDate(day.date)}, ${count === 0 ? "no commits" : `${count} commit${count === 1 ? "" : "s"}`}`
            : `Day ${index + 1}, no data`;
          return (
            <li key={index}>
              <button
                type="button"
                className={classes.join(" ")}
                aria-label={`Walk to ${label}`}
                onClick={() => {
                  onSelectDay(index);
                }}
                onMouseEnter={() => {
                  onHoverDay(index);
                }}
                onMouseLeave={() => {
                  onHoverDay(undefined);
                }}
                onFocus={() => {
                  onHoverDay(index);
                }}
                onBlur={() => {
                  onHoverDay(undefined);
                }}
              />
              <span className="path-stones__heat-dow" aria-hidden="true">
                {day ? WEEKDAY_INITIALS[weekdayOf(day.date)] : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="path-stones__heat-key">
        <span>quiet</span>
        <span className="path-stones__heat-cell path-stones__heat-cell--l0" aria-hidden="true" />
        <span className="path-stones__heat-cell path-stones__heat-cell--l1" aria-hidden="true" />
        <span className="path-stones__heat-cell path-stones__heat-cell--l2" aria-hidden="true" />
        <span className="path-stones__heat-cell path-stones__heat-cell--l3" aria-hidden="true" />
        <span>busy</span>
      </p>
    </section>
  );
};

export default ZazenHeatmap;
export { levelForCount, weekdayOf };
