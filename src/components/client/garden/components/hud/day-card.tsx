import type { MapTile } from "../../types";

interface Props {
  tile: MapTile | undefined;
  dayIndex: number | undefined;
  totalDays: number;
  inspecting: boolean;
}

const GROUND_LABEL: Record<string, string> = {
  "gravel-edge": "gravel",
  "moss-deep": "deep moss",
  "moss-mid": "moss",
  "sand-0": "raked sand",
  "sand-1": "raked sand",
  "sand-moss": "sand, moss creeping in",
  "shrine-active": "the shrine, awake",
  "shrine-locked": "the shrine, sleeping",
  "stone-slab": "stone",
  "water-still": "still water",
};

// "2026-03-14" -> "14 March 2026". Written out rather than localised: the date is read
// aloud by the live region, and a locale-dependent string would drift between visitors.
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatDate = (iso: string): string => {
  const [year, month, day] = iso.split("-");
  const index = Number.parseInt(month, 10) - 1;
  if (Number.isNaN(index) || !MONTHS[index]) {
    return iso;
  }
  return `${Number.parseInt(day, 10)} ${MONTHS[index]} ${year}`;
};

const ZazenDayCard = ({ tile, dayIndex, totalDays, inspecting }: Props) => {
  const day = tile?.day;
  const ground = tile ? (GROUND_LABEL[tile.sprite] ?? tile.sprite) : "";

  return (
    <aside
      className={
        inspecting ? "path-stones__day path-stones__day--inspecting" : "path-stones__day"
      }
      aria-labelledby="path-stones-day-title"
    >
      <h2 className="path-stones__day-title" id="path-stones-day-title">
        {inspecting ? "Looking at" : "Standing on"}
      </h2>

      {day ? (
        <>
          <p className="path-stones__day-date">{formatDate(day.date)}</p>
          <p className="path-stones__day-count">
            {day.count === 0 ? "no commits" : `${day.count} commit${day.count === 1 ? "" : "s"}`}
            {day.repo === "" ? "" : ` · ${day.repo}`}
          </p>
          {day.language !== "" && <p className="path-stones__day-lang">{day.language}</p>}
        </>
      ) : (
        <p className="path-stones__day-date">The garden's edge</p>
      )}

      <p className="path-stones__day-ground">{ground}</p>

      {dayIndex !== undefined && (
        <p className="path-stones__day-index" aria-hidden="true">
          day {dayIndex + 1} of {totalDays}
        </p>
      )}
    </aside>
  );
};

export default ZazenDayCard;
export { formatDate };
