import { useState } from "react";
import {
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  format, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type Period = "week" | "month" | "year" | "custom";

export interface PeriodValue {
  period: Period;
  start: string; // YYYY-MM-DD
  end: string;
}

const PERIOD_LABELS: Record<Period, string> = {
  week: "Semaine",
  month: "Mois",
  year: "Année",
  custom: "Personnaliser",
};

export const PERIOD_LABELS_THIS: Record<Period, string> = {
  week: "cette semaine",
  month: "ce mois",
  year: "cette année",
  custom: "sur la période",
};

const WEEK_OPTS = { weekStartsOn: 1 as const };

function fmt(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function defaultPeriodValue(period: Period = "month", ref: Date = new Date()): PeriodValue {
  if (period === "week") {
    return { period, start: fmt(startOfWeek(ref, WEEK_OPTS)), end: fmt(endOfWeek(ref, WEEK_OPTS)) };
  }
  if (period === "month") {
    return { period, start: fmt(startOfMonth(ref)), end: fmt(endOfMonth(ref)) };
  }
  if (period === "year") {
    return { period, start: fmt(startOfYear(ref)), end: fmt(endOfYear(ref)) };
  }
  // custom : par défaut le mois courant
  return { period, start: fmt(startOfMonth(ref)), end: fmt(endOfMonth(ref)) };
}

export function formatPeriodRange(value: PeriodValue): string {
  const s = parseISO(value.start);
  const e = parseISO(value.end);
  if (value.period === "week") {
    return `${format(s, "d", { locale: fr })} – ${format(e, "d MMM yyyy", { locale: fr })}`;
  }
  if (value.period === "month") {
    return format(s, "MMMM yyyy", { locale: fr });
  }
  if (value.period === "year") {
    return format(s, "yyyy");
  }
  return `${format(s, "d MMM yyyy", { locale: fr })} – ${format(e, "d MMM yyyy", { locale: fr })}`;
}

interface PeriodSelectorProps {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}

export const PeriodSelector = ({ value, onChange }: PeriodSelectorProps) => {
  const opts: Period[] = ["week", "month", "year", "custom"];
  const [open, setOpen] = useState(false);

  const btnClass = (p: Period) =>
    `px-3 py-1.5 text-sm font-medium transition-colors ${
      value.period === p
        ? "bg-secondary text-secondary-foreground"
        : "text-foreground hover:bg-muted"
    }`;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="inline-flex rounded-lg border border-border bg-card overflow-hidden">
        {opts.map((p) => {
          if (p === "custom") {
            return (
              <Popover key={p} open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={btnClass(p)}
                    onClick={() => {
                      if (value.period !== "custom") {
                        onChange({ ...value, period: "custom" });
                      }
                    }}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="end">
                  <div className="space-y-3">
                    <div>
                      <label className="label-uppercase block mb-1">Du</label>
                      <input
                        type="date"
                        value={value.start}
                        max={value.end}
                        onChange={(e) => onChange({ ...value, period: "custom", start: e.target.value })}
                        className="w-full h-9 px-2 border border-input rounded-md text-sm bg-card"
                      />
                    </div>
                    <div>
                      <label className="label-uppercase block mb-1">Au</label>
                      <input
                        type="date"
                        value={value.end}
                        min={value.start}
                        onChange={(e) => onChange({ ...value, period: "custom", end: e.target.value })}
                        className="w-full h-9 px-2 border border-input rounded-md text-sm bg-card"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            );
          }
          return (
            <button
              key={p}
              onClick={() => onChange(defaultPeriodValue(p))}
              className={btnClass(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground">{formatPeriodRange(value)}</div>
    </div>
  );
};

// Helper backward-compat pour les hooks qui prennent juste les bounds
export function getPeriodBounds(period: Period | PeriodValue, ref: Date = new Date()): { start: string; end: string } {
  if (typeof period === "string") {
    const v = defaultPeriodValue(period, ref);
    return { start: v.start, end: v.end };
  }
  return { start: period.start, end: period.end };
}
