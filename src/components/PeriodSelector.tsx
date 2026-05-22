import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";

export type Period = "week" | "month" | "year";

export const PERIOD_LABELS: Record<Period, string> = {
  week: "Semaine",
  month: "Mois",
  year: "Année",
};

export const PERIOD_LABELS_THIS: Record<Period, string> = {
  week: "cette semaine",
  month: "ce mois",
  year: "cette année",
};

export function getPeriodBounds(period: Period, ref: Date = new Date()): { start: string; end: string } {
  switch (period) {
    case "week":
      return {
        start: format(startOfWeek(ref, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end: format(endOfWeek(ref, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "month":
      return {
        start: format(startOfMonth(ref), "yyyy-MM-dd"),
        end: format(endOfMonth(ref), "yyyy-MM-dd"),
      };
    case "year":
      return {
        start: format(startOfYear(ref), "yyyy-MM-dd"),
        end: format(endOfYear(ref), "yyyy-MM-dd"),
      };
  }
}

interface PeriodSelectorProps {
  value: Period;
  onChange: (p: Period) => void;
}

export const PeriodSelector = ({ value, onChange }: PeriodSelectorProps) => {
  const opts: Period[] = ["week", "month", "year"];
  return (
    <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden">
      {opts.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            value === p
              ? "bg-secondary text-secondary-foreground"
              : "text-foreground hover:bg-muted"
          }`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
};
