import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Calendar, BarChart3, AlertTriangle, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import AppLayout from "@/components/AppLayout";

// Shared data (same missions/consultants as rest of app)
const missions = [
  { id: 1, client: "EcoTech Solutions", project: "Bilan Carbone 2025", pole: "Releaf Carbon" },
  { id: 2, client: "Ville de Lyon", project: "Plan Climat Territorial", pole: "Releaf Energy" },
  { id: 3, client: "AgroVert", project: "Audit Biodiversité", pole: "Releaf Biodiversity" },
  { id: 4, client: "TransportPlus", project: "Mobilité Durable", pole: "Releaf LCA" },
];

const consultants = [
  { id: "md", name: "Marie Dupont", profile: "Senior" },
  { id: "lm", name: "Luc Martin", profile: "Manager" },
  { id: "sb", name: "Sophie Bernard", profile: "Senior" },
  { id: "ap", name: "Antoine Petit", profile: "Junior" },
  { id: "cm", name: "Claire Moreau", profile: "Manager" },
  { id: "jl", name: "Julie Lambert", profile: "Junior" },
];

const poleColors: Record<string, string> = {
  "Releaf Carbon": "bg-primary/10 text-primary",
  "Releaf LCA": "bg-secondary/10 text-secondary",
  "Releaf Energy": "bg-[hsl(38,80%,50%)]/10 text-[hsl(38,80%,40%)]",
  "Releaf Water": "bg-[hsl(200,70%,50%)]/10 text-[hsl(200,70%,35%)]",
  "Releaf Biodiversity": "bg-accent text-accent-foreground",
};

const poleBgColors: Record<string, string> = {
  "Releaf Carbon": "bg-primary/20",
  "Releaf LCA": "bg-secondary/20",
  "Releaf Energy": "bg-[hsl(38,80%,50%)]/20",
  "Releaf Water": "bg-[hsl(200,70%,50%)]/20",
  "Releaf Biodiversity": "bg-accent/60",
};

type ForecastLine = {
  consultantId: string;
  daysPerWeek: number;
};

type ForecastEntry = {
  id: number;
  missionId: number;
  startDate: string;
  endDate: string;
  lines: ForecastLine[];
};

// Generate week labels between two dates
const getWeeksBetween = (start: string, end: string): { label: string; startDate: Date }[] => {
  const weeks: { label: string; startDate: Date }[] = [];
  const s = new Date(start);
  const e = new Date(end);
  // Align to Monday
  const day = s.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  s.setDate(s.getDate() + diff);

  while (s <= e) {
    const weekEnd = new Date(s);
    weekEnd.setDate(weekEnd.getDate() + 4);
    const label = `${s.getDate()}/${s.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
    weeks.push({ label, startDate: new Date(s) });
    s.setDate(s.getDate() + 7);
  }
  return weeks;
};

const generateRealData = (forecast: ForecastEntry): Record<string, Record<number, number>> => {
  const weeks = getWeeksBetween(forecast.startDate, forecast.endDate);
  const result: Record<string, Record<number, number>> = {};
  forecast.lines.forEach((line) => {
    result[line.consultantId] = {};
    weeks.forEach((_, wi) => {
      const base = line.daysPerWeek;
      const variance = (Math.random() - 0.4) * 1.5;
      result[line.consultantId][wi] = Math.max(0, Math.round((base + variance) * 2) / 2);
    });
  });
  return result;
};

// Initial demo forecasts
const initialForecasts: ForecastEntry[] = [
  {
    id: 1,
    missionId: 1,
    startDate: "2025-03-01",
    endDate: "2025-05-31",
    lines: [
      { consultantId: "md", daysPerWeek: 2 },
      { consultantId: "lm", daysPerWeek: 1 },
    ],
  },
  {
    id: 2,
    missionId: 2,
    startDate: "2025-03-15",
    endDate: "2025-06-15",
    lines: [
      { consultantId: "sb", daysPerWeek: 3 },
      { consultantId: "ap", daysPerWeek: 1.5 },
    ],
  },
];

const Forecast = () => {
  const [forecasts, setForecasts] = useState<ForecastEntry[]>(initialForecasts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [filterConsultant, setFilterConsultant] = useState<string>("all");
  const [filterMission, setFilterMission] = useState<string>("all");

  const [newMissionId, setNewMissionId] = useState<string>("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLines, setNewLines] = useState<ForecastLine[]>([]);
  const [newLineConsultant, setNewLineConsultant] = useState("");
  const [newLineDays, setNewLineDays] = useState("1");

  const [realDataCache] = useState<Record<number, Record<string, Record<number, number>>>>(() => {
    const cache: Record<number, Record<string, Record<number, number>>> = {};
    initialForecasts.forEach((f) => {
      cache[f.id] = generateRealData(f);
    });
    return cache;
  });

  const addLineToNew = () => {
    if (!newLineConsultant || !newLineDays) return;
    if (newLines.find((l) => l.consultantId === newLineConsultant)) return;
    setNewLines([...newLines, { consultantId: newLineConsultant, daysPerWeek: parseFloat(newLineDays) }]);
    setNewLineConsultant("");
    setNewLineDays("1");
  };

  const removeLineFromNew = (cId: string) => {
    setNewLines(newLines.filter((l) => l.consultantId !== cId));
  };

  const saveForecast = () => {
    if (!newMissionId || !newStart || !newEnd || newLines.length === 0) return;
    const entry: ForecastEntry = {
      id: Date.now(),
      missionId: parseInt(newMissionId),
      startDate: newStart,
      endDate: newEnd,
      lines: [...newLines],
    };
    setForecasts([...forecasts, entry]);
    realDataCache[entry.id] = generateRealData(entry);
    setDialogOpen(false);
    setNewMissionId("");
    setNewStart("");
    setNewEnd("");
    setNewLines([]);
  };

  const getMission = (id: number) => missions.find((m) => m.id === id);
  const getConsultant = (id: string) => consultants.find((c) => c.id === id);

  const globalWeeks = useMemo(() => {
    if (forecasts.length === 0) return [];
    const allDates = forecasts.flatMap((f) => [new Date(f.startDate), new Date(f.endDate)]);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    return getWeeksBetween(minDate.toISOString().slice(0, 10), maxDate.toISOString().slice(0, 10));
  }, [forecasts]);

  const planningData = useMemo(() => {
    const data: Record<string, Record<number, { missionId: number; days: number }[]>> = {};
    forecasts.forEach((f) => {
      const fWeeks = getWeeksBetween(f.startDate, f.endDate);
      f.lines.forEach((line) => {
        if (filterConsultant !== "all" && line.consultantId !== filterConsultant) return;
        if (filterMission !== "all" && f.missionId !== parseInt(filterMission)) return;
        if (!data[line.consultantId]) data[line.consultantId] = {};
        fWeeks.forEach((fw) => {
          const gwi = globalWeeks.findIndex(
            (gw) => gw.startDate.getTime() === fw.startDate.getTime()
          );
          if (gwi === -1) return;
          if (!data[line.consultantId][gwi]) data[line.consultantId][gwi] = [];
          data[line.consultantId][gwi].push({ missionId: f.missionId, days: line.daysPerWeek });
        });
      });
    });
    return data;
  }, [forecasts, globalWeeks, filterConsultant, filterMission]);

  const [weekOffset, setWeekOffset] = useState(0);
  const visibleWeeks = 8;
  const displayedWeeks = globalWeeks.slice(weekOffset, weekOffset + visibleWeeks);

  const detailForecast = detailId !== null ? forecasts.find((f) => f.id === detailId) : null;

  return (
    <AppLayout role="admin">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-primary">Prévisionnel</h2>
        <Button onClick={() => setDialogOpen(true)} className="rounded-lg">
          <Plus size={16} className="mr-1" /> Nouveau prévisionnel
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {forecasts.map((f) => {
          const mission = getMission(f.missionId);
          if (!mission) return null;
          const totalDaysPerWeek = f.lines.reduce((a, l) => a + l.daysPerWeek, 0);
          const weeks = getWeeksBetween(f.startDate, f.endDate);

          return (
            <Card key={f.id} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{mission.client}</CardTitle>
                    <p className="text-sm text-muted-foreground">{mission.project}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${poleColors[mission.pole]}`}>
                    {mission.pole}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
                  <div>
                    <span className="label-uppercase block">Période</span>
                    <span className="text-foreground">{f.startDate} → {f.endDate}</span>
                  </div>
                  <div>
                    <span className="label-uppercase block">Semaines</span>
                    <span className="text-foreground">{weeks.length}</span>
                  </div>
                  <div>
                    <span className="label-uppercase block">Charge / sem.</span>
                    <span className="text-foreground">{totalDaysPerWeek}j</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {f.lines.map((line) => {
                    const c = getConsultant(line.consultantId);
                    return (
                      <span
                        key={line.consultantId}
                        className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded-md"
                      >
                        {c?.name} · {line.daysPerWeek}j/sem
                      </span>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setDetailId(f.id)}
                >
                  <Eye size={14} className="mr-1" /> Voir le comparatif
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-card rounded-lg border border-border p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-primary text-base flex items-center gap-2">
            <Calendar size={18} className="text-secondary" />
            Planning prévisionnel
          </h3>
          <div className="flex items-center gap-3">
            <Select value={filterConsultant} onValueChange={setFilterConsultant}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Consultant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les consultants</SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMission} onValueChange={setFilterMission}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Mission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les missions</SelectItem>
                {missions.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.client} — {m.project}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "weekly" | "monthly")}>
              <TabsList className="h-8">
                <TabsTrigger value="weekly" className="text-xs px-3 h-6">Semaine</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs px-3 h-6">Mois</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {globalWeeks.length > 0 ? (
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={weekOffset === 0}
                onClick={() => setWeekOffset(Math.max(0, weekOffset - visibleWeeks))}
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs text-muted-foreground">
                Semaines {weekOffset + 1}–{Math.min(weekOffset + visibleWeeks, globalWeeks.length)} sur {globalWeeks.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={weekOffset + visibleWeeks >= globalWeeks.length}
                onClick={() => setWeekOffset(weekOffset + visibleWeeks)}
              >
                <ChevronRight size={14} />
              </Button>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 label-uppercase w-48">Consultant</th>
                  {displayedWeeks.map((w, i) => (
                    <th key={i} className="text-center px-1 py-2 label-uppercase text-[10px] min-w-[80px]">
                      {w.label}
                    </th>
                  ))}
                  <th className="text-center px-2 py-2 label-uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(planningData).map(([cId, weekData]) => {
                  const c = getConsultant(cId);
                  if (!c) return null;
                  let rowTotal = 0;

                  return (
                    <tr key={cId} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground text-sm">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.profile}</div>
                      </td>
                      {displayedWeeks.map((_, i) => {
                        const wi = weekOffset + i;
                        const entries = weekData[wi] || [];
                        const totalDays = entries.reduce((a, e) => a + e.days, 0);
                        rowTotal += totalDays;
                        const overloaded = totalDays > 5;

                        return (
                          <td key={i} className="text-center px-1 py-2">
                            {entries.length > 0 ? (
                              <div className="space-y-0.5">
                                {entries.map((entry, ei) => {
                                  const m = getMission(entry.missionId);
                                  return (
                                    <div
                                      key={ei}
                                      className={`text-[10px] font-medium px-1 py-0.5 rounded ${poleBgColors[m?.pole || ""] || "bg-muted"}`}
                                      title={`${m?.client} — ${entry.days}j`}
                                    >
                                      {entry.days}j
                                    </div>
                                  );
                                })}
                                {overloaded && (
                                  <div className="text-destructive text-[10px] font-bold">⚠ {totalDays}j</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center px-2 py-2 font-semibold text-primary text-sm">
                        {rowTotal}j
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun prévisionnel créé. Commencez par ajouter un prévisionnel pour une mission.
          </p>
        )}
      </div>

      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-auto">
          {detailForecast && (() => {
            const mission = getMission(detailForecast.missionId);
            const weeks = getWeeksBetween(detailForecast.startDate, detailForecast.endDate);
            const realData = realDataCache[detailForecast.id] || {};

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <BarChart3 size={18} className="text-secondary" />
                    Comparatif Prévu vs Réel — {mission?.client}
                    {mission?.pole && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${poleColors[mission.pole]}`}>
                        {mission.pole}
                      </span>
                    )}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {detailForecast.lines.map((line) => {
                    const c = getConsultant(line.consultantId);
                    const consultantReal = realData[line.consultantId] || {};

                    return (
                      <div key={line.consultantId}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm text-foreground">{c?.name}</span>
                          <span className="text-xs text-muted-foreground">({c?.profile})</span>
                          <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">
                            Prévu : {line.daysPerWeek}j/sem
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left px-2 py-1.5 label-uppercase w-24">Semaine</th>
                                <th className="text-center px-2 py-1.5 label-uppercase">Prévu</th>
                                <th className="text-center px-2 py-1.5 label-uppercase">Réel</th>
                                <th className="text-center px-2 py-1.5 label-uppercase">Écart</th>
                                <th className="text-center px-2 py-1.5 label-uppercase">Statut</th>
                              </tr>
                            </thead>
                            <tbody>
                              {weeks.map((w, wi) => {
                                const planned = line.daysPerWeek;
                                const actual = consultantReal[wi] ?? 0;
                                const diff = actual - planned;

                                let statusColor = "text-secondary";
                                let statusLabel = "OK";
                                let statusBg = "bg-secondary/10";

                                if (diff > 0.5) {
                                  statusColor = "text-destructive";
                                  statusLabel = "Dépassement";
                                  statusBg = "bg-destructive/10";
                                } else if (diff > 0) {
                                  statusColor = "text-[hsl(38,80%,40%)]";
                                  statusLabel = "Attention";
                                  statusBg = "bg-[hsl(38,80%,50%)]/10";
                                } else if (diff < -0.5) {
                                  statusColor = "text-muted-foreground";
                                  statusLabel = "Sous-charge";
                                  statusBg = "bg-muted";
                                }

                                return (
                                  <tr key={wi} className="border-b border-border last:border-0">
                                    <td className="px-2 py-1.5 text-muted-foreground">{w.label}</td>
                                    <td className="text-center px-2 py-1.5 font-medium">{planned}j</td>
                                    <td className="text-center px-2 py-1.5 font-medium">{actual}j</td>
                                    <td className={`text-center px-2 py-1.5 font-semibold ${statusColor}`}>
                                      {diff > 0 ? "+" : ""}{diff}j
                                    </td>
                                    <td className="text-center px-2 py-1.5">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusBg} ${statusColor}`}>
                                        {statusLabel}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau prévisionnel</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="label-uppercase block mb-1.5">Mission</label>
              <Select value={newMissionId} onValueChange={setNewMissionId}>
                <SelectTrigger className="border-input">
                  <SelectValue placeholder="Sélectionner une mission" />
                </SelectTrigger>
                <SelectContent>
                  {missions.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.client} — {m.project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-uppercase block mb-1.5">Date de début</label>
                <Input
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="border-input"
                />
              </div>
              <div>
                <label className="label-uppercase block mb-1.5">Date de fin</label>
                <Input
                  type="date"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="border-input"
                />
              </div>
            </div>

            <div>
              <label className="label-uppercase block mb-1.5">Ressources</label>
              <div className="space-y-2 mb-3">
                {newLines.map((line) => {
                  const c = getConsultant(line.consultantId);
                  return (
                    <div
                      key={line.consultantId}
                      className="flex items-center justify-between bg-accent/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm font-medium">{c?.name} <span className="text-muted-foreground">({c?.profile})</span></span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-secondary font-semibold">{line.daysPerWeek}j/sem</span>
                        <button onClick={() => removeLineFromNew(line.consultantId)} className="text-muted-foreground hover:text-destructive">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select value={newLineConsultant} onValueChange={setNewLineConsultant}>
                    <SelectTrigger className="border-input h-9 text-sm">
                      <SelectValue placeholder="Consultant" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants
                        .filter((c) => !newLines.find((l) => l.consultantId === c.id))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.profile})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    step={0.5}
                    min={0.5}
                    max={5}
                    value={newLineDays}
                    onChange={(e) => setNewLineDays(e.target.value)}
                    className="border-input h-9 text-sm text-center"
                    placeholder="j/sem"
                  />
                </div>
                <Button variant="outline" size="sm" className="h-9" onClick={addLineToNew}>
                  <Plus size={14} />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={saveForecast} disabled={!newMissionId || !newStart || !newEnd || newLines.length === 0}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Forecast;
