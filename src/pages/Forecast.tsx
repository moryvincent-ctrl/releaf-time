import { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Plus, X, Calendar, BarChart3, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Save } from "lucide-react";
import AppLayout from "@/components/AppLayout";

// ── Shared data ──
const missions = [
  { id: 1, client: "EcoTech Solutions", project: "Bilan Carbone 2025", pole: "Releaf Carbon", manager: "lm" },
  { id: 2, client: "Ville de Lyon", project: "Plan Climat Territorial", pole: "Releaf Energy", manager: "cm" },
  { id: 3, client: "AgroVert", project: "Formation RSE", pole: "Releaf Campus", manager: "lm" },
  { id: 4, client: "TransportPlus", project: "Mobilité Durable", pole: "Releaf LCA", manager: "cm" },
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
  "Releaf Tools": "bg-[hsl(270,50%,55%)]/10 text-[hsl(270,50%,40%)]",
  "Releaf Campus": "bg-[hsl(200,70%,50%)]/10 text-[hsl(200,70%,35%)]",
};

const poleChartColors: Record<string, string> = {
  "Releaf Carbon": "hsl(153, 42%, 18%)",
  "Releaf LCA": "hsl(152, 44%, 52%)",
  "Releaf Energy": "hsl(38, 80%, 50%)",
  "Releaf Tools": "hsl(270, 50%, 55%)",
  "Releaf Campus": "hsl(200, 70%, 50%)",
};

// Mission chart colors (for per-consultant stacked bars)
const missionChartColors: string[] = [
  "hsl(153, 42%, 18%)",
  "hsl(152, 44%, 52%)",
  "hsl(38, 80%, 50%)",
  "hsl(270, 50%, 55%)",
  "hsl(200, 70%, 50%)",
  "hsl(340, 60%, 50%)",
  "hsl(20, 70%, 55%)",
];

const poleBgColors: Record<string, string> = {
  "Releaf Carbon": "bg-primary/20",
  "Releaf LCA": "bg-secondary/20",
  "Releaf Energy": "bg-[hsl(38,80%,50%)]/20",
  "Releaf Tools": "bg-[hsl(270,50%,55%)]/20",
  "Releaf Campus": "bg-[hsl(200,70%,50%)]/20",
};

const dayOptions = [0, 0.25, 0.5, 0.75, 1];

// ── Week helpers ──
const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatWeekLabel = (monday: Date): string => {
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  const weekNum = getWeekNumber(monday);
  const months = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
  return `S${weekNum} · ${monday.getDate()}-${friday.getDate()} ${months[friday.getMonth()]}`;
};

const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const generateWeeks = (count: number, startOffset = 0): Date[] => {
  const today = new Date();
  const start = getMonday(today);
  start.setDate(start.getDate() + startOffset * 7);
  const weeks: Date[] = [];
  for (let i = 0; i < count; i++) {
    const w = new Date(start);
    w.setDate(w.getDate() + i * 7);
    weeks.push(w);
  }
  return weeks;
};

const weekKey = (d: Date) => d.toISOString().slice(0, 10);

// ── Types ──
type ForecastCell = Record<string, Record<string, Record<string, number>>>;
// forecastData[missionId][consultantId][weekKey] = days (0-1 per day)

// ── Simulated real time data ──
const generateRealData = (forecastData: ForecastCell): Record<string, Record<string, number>> => {
  const result: Record<string, Record<string, number>> = {};
  Object.entries(forecastData).forEach(([mId, consultants]) => {
    Object.entries(consultants).forEach(([cId, weeks]) => {
      if (!result[cId]) result[cId] = {};
      Object.entries(weeks).forEach(([wk, planned]) => {
        const current = result[cId][`${mId}_${wk}`] || 0;
        const variance = (Math.random() - 0.3) * 0.5;
        result[cId][`${mId}_${wk}`] = Math.max(0, Math.round((planned + variance) * 4) / 4);
        // Also aggregate by week
        result[cId][wk] = (result[cId][wk] || 0) + Math.max(0, Math.round((planned + variance) * 4) / 4);
      });
    });
  });
  return result;
};

// ── Initial demo data ──
const buildInitialData = (): ForecastCell => {
  const data: ForecastCell = {};
  const weeks = generateWeeks(12);
  // Mission 1: md 0.5/day, lm 0.25/day
  data["1"] = {
    md: Object.fromEntries(weeks.map((w) => [weekKey(w), 0.5])),
    ap: Object.fromEntries(weeks.map((w) => [weekKey(w), 0.25])),
  };
  // Mission 2: sb 0.75/day, ap 0.5/day
  data["2"] = {
    sb: Object.fromEntries(weeks.map((w) => [weekKey(w), 0.75])),
    ap: Object.fromEntries(weeks.slice(0, 8).map((w) => [weekKey(w), 0.5])),
  };
  // Mission 3: md 0.25
  data["3"] = {
    md: Object.fromEntries(weeks.slice(2, 10).map((w) => [weekKey(w), 0.25])),
    jl: Object.fromEntries(weeks.map((w) => [weekKey(w), 0.5])),
  };
  return data;
};

// ── Component ──
const Forecast = () => {
  const location = useLocation();
  const isManager = location.pathname.includes("/manager") || location.pathname === "/forecast";
  const isAdmin = location.pathname === "/forecast" || location.pathname.includes("/admin");

  // Determine role from path context
  const role: "manager" | "admin" = location.pathname.startsWith("/manager") ? "manager" : "admin";

  const [forecastData, setForecastData] = useState<ForecastCell>(buildInitialData);
  const [weeks] = useState(() => generateWeeks(12));
  const [weekOffset, setWeekOffset] = useState(0);
  const visibleWeekCount = 8;

  // Filters (admin)
  const [filterConsultant, setFilterConsultant] = useState("all");
  const [filterMission, setFilterMission] = useState("all");
  const [filterPole, setFilterPole] = useState("all");
  const [chartView, setChartView] = useState<"consultant" | "pole">("consultant");

  // Manager: selected mission for editing
  const [selectedMission, setSelectedMission] = useState<string>(String(missions[0].id));
  const [expandedConsultants, setExpandedConsultants] = useState<Record<string, boolean>>({});

  // Real data cache
  const [realData] = useState(() => generateRealData(buildInitialData()));

  const displayedWeeks = weeks.slice(weekOffset, weekOffset + visibleWeekCount);

  const getMission = (id: number | string) => missions.find((m) => m.id === Number(id));
  const getConsultant = (id: string) => consultants.find((c) => c.id === id);

  // ── Manager: update a cell ──
  const updateCell = (missionId: string, consultantId: string, wk: string, value: number) => {
    setForecastData((prev) => {
      const next = { ...prev };
      if (!next[missionId]) next[missionId] = {};
      if (!next[missionId][consultantId]) next[missionId][consultantId] = {};
      next[missionId][consultantId] = { ...next[missionId][consultantId], [wk]: value };
      return next;
    });
  };

  // ── Manager: add consultant to mission ──
  const [addConsultantMission, setAddConsultantMission] = useState("");
  const addConsultantToMission = (missionId: string, consultantId: string) => {
    if (!consultantId) return;
    setForecastData((prev) => {
      const next = { ...prev };
      if (!next[missionId]) next[missionId] = {};
      if (next[missionId][consultantId]) return prev;
      next[missionId][consultantId] = {};
      weeks.forEach((w) => {
        next[missionId][consultantId][weekKey(w)] = 0;
      });
      return next;
    });
    setAddConsultantMission("");
  };

  const removeConsultantFromMission = (missionId: string, consultantId: string) => {
    setForecastData((prev) => {
      const next = { ...prev };
      if (next[missionId]) {
        const { [consultantId]: _, ...rest } = next[missionId];
        next[missionId] = rest;
      }
      return next;
    });
  };

  // ── Manager: get consultants for selected mission ──
  const missionConsultants = useMemo(() => {
    const mData = forecastData[selectedMission] || {};
    return Object.keys(mData);
  }, [forecastData, selectedMission]);

  const availableConsultantsForMission = consultants.filter(
    (c) => !missionConsultants.includes(c.id)
  );

  // ── Overload detection ──
  const getConsultantWeekTotal = (consultantId: string, wk: string): number => {
    let total = 0;
    Object.entries(forecastData).forEach(([, mData]) => {
      if (mData[consultantId]?.[wk]) {
        total += mData[consultantId][wk];
      }
    });
    return total;
  };

  // ── Admin: chart data ──
  const chartData = useMemo(() => {
    return displayedWeeks.map((w) => {
      const wk = weekKey(w);
      const entry: Record<string, any> = { week: formatWeekLabel(w) };
      const uniquePoles = new Set<string>();
      
      Object.entries(forecastData).forEach(([mId, mData]) => {
        const mission = getMission(mId);
        if (!mission) return;
        if (filterPole !== "all" && mission.pole !== filterPole) return;
        
        let missionTotal = 0;
        Object.entries(mData).forEach(([cId, weeks]) => {
          if (filterConsultant !== "all" && cId !== filterConsultant) return;
          missionTotal += (weeks[wk] || 0) * 5; // convert daily fraction to weekly days
        });
        
        if (missionTotal > 0) {
          const key = mission.pole;
          entry[key] = (entry[key] || 0) + missionTotal;
          uniquePoles.add(key);
        }
      });
      
      return entry;
    });
  }, [forecastData, displayedWeeks, filterConsultant, filterPole]);

  const activePoles = useMemo(() => {
    const poles = new Set<string>();
    Object.entries(forecastData).forEach(([mId]) => {
      const m = getMission(mId);
      if (m) poles.add(m.pole);
    });
    return Array.from(poles);
  }, [forecastData]);

  // ── Admin: consultant detail table data ──
  const adminConsultantData = useMemo(() => {
    const data: Record<string, Record<string, { planned: number; missions: { missionId: string; days: number }[] }>> = {};
    
    Object.entries(forecastData).forEach(([mId, mData]) => {
      const mission = getMission(mId);
      if (!mission) return;
      if (filterPole !== "all" && mission.pole !== filterPole) return;
      if (filterMission !== "all" && mId !== filterMission) return;
      
      Object.entries(mData).forEach(([cId, wData]) => {
        if (filterConsultant !== "all" && cId !== filterConsultant) return;
        if (!data[cId]) data[cId] = {};
        
        Object.entries(wData).forEach(([wk, days]) => {
          if (!data[cId][wk]) data[cId][wk] = { planned: 0, missions: [] };
          const weekDays = days * 5;
          data[cId][wk].planned += weekDays;
          data[cId][wk].missions.push({ missionId: mId, days: weekDays });
        });
      });
    });
    
    return data;
  }, [forecastData, filterConsultant, filterMission, filterPole]);

  const toggleExpanded = (cId: string) => {
    setExpandedConsultants((prev) => ({ ...prev, [cId]: !prev[cId] }));
  };

  // ── RENDER ──
  if (role === "manager") {
    // ═══════════════════════════════════════
    // MANAGER VIEW: Saisie + Planning
    // ═══════════════════════════════════════
    const mission = getMission(selectedMission);
    
    return (
      <AppLayout role="manager">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-heading font-semibold text-primary">Prévisionnel</h2>
        </div>

        <Tabs defaultValue="saisie">
          <TabsList className="mb-6">
            <TabsTrigger value="saisie">Saisie prévisionnel</TabsTrigger>
            <TabsTrigger value="planning">Mon planning prévisionnel</TabsTrigger>
          </TabsList>

          {/* ── TAB: Saisie ── */}
          <TabsContent value="saisie">
            <div className="flex items-center gap-4 mb-5">
              <label className="label-uppercase">Mission</label>
              <Select value={selectedMission} onValueChange={setSelectedMission}>
                <SelectTrigger className="w-72 border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {missions.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.client} — {m.project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mission && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${poleColors[mission.pole]}`}>
                  {mission.pole}
                </span>
              )}
            </div>

            <Card className="border-border mb-4">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={weekOffset === 0}
                      onClick={() => setWeekOffset(Math.max(0, weekOffset - visibleWeekCount))}
                    >
                      <ChevronLeft size={14} />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Semaines {weekOffset + 1}–{Math.min(weekOffset + visibleWeekCount, weeks.length)} sur {weeks.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={weekOffset + visibleWeekCount >= weeks.length}
                      onClick={() => setWeekOffset(weekOffset + visibleWeekCount)}
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                  <Button size="sm" className="rounded-lg">
                    <Save size={14} className="mr-1" /> Sauvegarder
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-2.5 label-uppercase w-52">Consultant</th>
                        {displayedWeeks.map((w, i) => (
                          <th key={i} className="text-center px-1 py-2.5 label-uppercase text-[10px] min-w-[90px]">
                            {formatWeekLabel(w)}
                          </th>
                        ))}
                        <th className="text-center px-3 py-2.5 label-uppercase">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {missionConsultants.map((cId) => {
                        const c = getConsultant(cId);
                        if (!c) return null;
                        const cellData = forecastData[selectedMission]?.[cId] || {};
                        let total = 0;

                        return (
                          <tr key={cId} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-foreground text-sm">{c.name}</div>
                              <div className="text-xs text-muted-foreground">{c.profile}</div>
                            </td>
                            {displayedWeeks.map((w, i) => {
                              const wk = weekKey(w);
                              const val = cellData[wk] || 0;
                              total += val * 5;
                              const weekTotal = getConsultantWeekTotal(cId, wk);
                              const overloaded = weekTotal > 1; // >5 days/week = >1 per day

                              return (
                                <td key={i} className="text-center px-1 py-1.5">
                                  <select
                                    value={val}
                                    onChange={(e) => updateCell(selectedMission, cId, wk, parseFloat(e.target.value))}
                                    className={`w-16 h-8 text-xs text-center rounded-md border bg-card focus:ring-2 focus:ring-ring cursor-pointer ${
                                      overloaded ? "border-destructive bg-destructive/5" : "border-input"
                                    }`}
                                  >
                                    {dayOptions.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt === 0 ? "—" : `${opt}j`}
                                      </option>
                                    ))}
                                  </select>
                                  {overloaded && (
                                    <div className="text-destructive text-[9px] mt-0.5 font-semibold">
                                      ⚠ {(weekTotal * 5).toFixed(1)}j/sem
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="text-center px-3 py-2.5 font-semibold text-primary text-sm">
                              {total.toFixed(1)}j
                            </td>
                            <td className="px-1">
                              <button
                                onClick={() => removeConsultantFromMission(selectedMission, cId)}
                                className="text-muted-foreground hover:text-destructive p-1"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add consultant */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/20">
                  <Select value={addConsultantMission} onValueChange={setAddConsultantMission}>
                    <SelectTrigger className="w-56 h-8 text-xs border-input">
                      <SelectValue placeholder="Ajouter un consultant…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableConsultantsForMission.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.profile})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!addConsultantMission}
                    onClick={() => addConsultantToMission(selectedMission, addConsultantMission)}
                  >
                    <Plus size={14} className="mr-1" /> Ajouter
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Planning Manager ── */}
          <TabsContent value="planning">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar size={18} className="text-secondary" />
                  Mon planning prévisionnel
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
                  <Button
                    variant="outline" size="icon" className="h-7 w-7"
                    disabled={weekOffset === 0}
                    onClick={() => setWeekOffset(Math.max(0, weekOffset - visibleWeekCount))}
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Semaines {weekOffset + 1}–{Math.min(weekOffset + visibleWeekCount, weeks.length)} sur {weeks.length}
                  </span>
                  <Button
                    variant="outline" size="icon" className="h-7 w-7"
                    disabled={weekOffset + visibleWeekCount >= weeks.length}
                    onClick={() => setWeekOffset(weekOffset + visibleWeekCount)}
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-2.5 label-uppercase w-52">Mission / Consultant</th>
                        {displayedWeeks.map((w, i) => (
                          <th key={i} className="text-center px-1 py-2.5 label-uppercase text-[10px] min-w-[80px]">
                            {formatWeekLabel(w)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {missions.map((m) => {
                        const mData = forecastData[String(m.id)] || {};
                        const mConsultants = Object.keys(mData);
                        if (mConsultants.length === 0) return null;

                        return (
                          <React.Fragment key={m.id}>
                            <tr className="border-b border-border bg-muted/30">
                              <td className="px-4 py-2" colSpan={displayedWeeks.length + 1}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-foreground">{m.client}</span>
                                  <span className="text-xs text-muted-foreground">— {m.project}</span>
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${poleColors[m.pole]}`}>{m.pole}</span>
                                </div>
                              </td>
                            </tr>
                            {mConsultants.map((cId) => {
                              const c = getConsultant(cId);
                              if (!c) return null;

                              return (
                                <tr key={`${m.id}-${cId}`} className="border-b border-border last:border-0">
                                  <td className="px-4 py-2 pl-8">
                                    <span className="text-sm text-foreground">{c.name}</span>
                                    <span className="text-xs text-muted-foreground ml-1">({c.profile})</span>
                                  </td>
                                  {displayedWeeks.map((w, i) => {
                                    const wk = weekKey(w);
                                    const val = mData[cId]?.[wk] || 0;
                                    const globalTotal = getConsultantWeekTotal(cId, wk);
                                    const overloaded = globalTotal > 1;

                                    return (
                                      <td key={i} className="text-center px-1 py-1.5">
                                        {val > 0 ? (
                                          <div className={`inline-block text-xs font-medium px-2 py-1 rounded ${poleBgColors[m.pole] || "bg-muted"}`}>
                                            {(val * 5).toFixed(1)}j
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground/30">—</span>
                                        )}
                                        {overloaded && (
                                          <div className="text-destructive text-[9px] font-semibold">⚠ {(globalTotal * 5).toFixed(1)}j</div>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </AppLayout>
    );
  }

  // ═══════════════════════════════════════
  // ADMIN VIEW: Staffing global
  // ═══════════════════════════════════════
  return (
    <AppLayout role="admin">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-heading font-semibold text-primary">Staffing global</h2>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Select value={filterConsultant} onValueChange={setFilterConsultant}>
          <SelectTrigger className="w-48 h-9 text-xs border-input">
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
          <SelectTrigger className="w-52 h-9 text-xs border-input">
            <SelectValue placeholder="Mission" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les missions</SelectItem>
            {missions.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>{m.client} — {m.project}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPole} onValueChange={setFilterPole}>
          <SelectTrigger className="w-44 h-9 text-xs border-input">
            <SelectValue placeholder="Entité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les entités</SelectItem>
            {activePoles.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stacked bar chart */}
      <Card className="border-border mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 size={18} className="text-secondary" />
            Charge prévisionnelle par semaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150, 25%, 91%)" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: "Jours", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(150,25%,91%)" }}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}j`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {activePoles.map((pole) => (
                  <Bar
                    key={pole}
                    dataKey={pole}
                    stackId="a"
                    fill={poleChartColors[pole] || "#999"}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Week navigation */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          disabled={weekOffset === 0}
          onClick={() => setWeekOffset(Math.max(0, weekOffset - visibleWeekCount))}
        >
          <ChevronLeft size={14} />
        </Button>
        <span className="text-xs text-muted-foreground">
          Semaines {weekOffset + 1}–{Math.min(weekOffset + visibleWeekCount, weeks.length)} sur {weeks.length}
        </span>
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          disabled={weekOffset + visibleWeekCount >= weeks.length}
          onClick={() => setWeekOffset(weekOffset + visibleWeekCount)}
        >
          <ChevronRight size={14} />
        </Button>
      </div>

      {/* Consultant detail table */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Détail par consultant</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 label-uppercase w-52">Consultant</th>
                  {displayedWeeks.map((w, i) => (
                    <th key={i} className="text-center px-1 py-2.5 label-uppercase text-[10px] min-w-[90px]">
                      {formatWeekLabel(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(adminConsultantData).map(([cId, weekData]) => {
                  const c = getConsultant(cId);
                  if (!c) return null;
                  const isExpanded = expandedConsultants[cId] || false;

                  return (
                    <React.Fragment key={cId}>
                      <tr
                        className="border-b border-border hover:bg-muted/30 cursor-pointer"
                        onClick={() => toggleExpanded(cId)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                            <div>
                              <div className="font-medium text-foreground text-sm">{c.name}</div>
                              <div className="text-xs text-muted-foreground">{c.profile}</div>
                            </div>
                          </div>
                        </td>
                        {displayedWeeks.map((w, i) => {
                          const wk = weekKey(w);
                          const data = weekData[wk];
                          const planned = data?.planned || 0;
                          const real = realData[cId]?.[wk] || 0;
                          const diff = real - planned;
                          const overloaded = planned > 5;

                          let statusClass = "text-secondary";
                          if (diff > 0.5) statusClass = "text-destructive";
                          else if (diff > 0) statusClass = "text-[hsl(38,80%,40%)]";

                          return (
                            <td key={i} className="text-center px-1 py-2">
                              {planned > 0 ? (
                                <div>
                                  <div className="text-xs font-semibold">{planned.toFixed(1)}j</div>
                                  <div className={`text-[10px] ${statusClass}`}>
                                    réel: {real.toFixed(1)}j
                                  </div>
                                  {overloaded && (
                                    <div className="text-destructive text-[9px] font-bold">⚠ surcharge</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {isExpanded && (
                        <>
                          {(weekData[weekKey(displayedWeeks[0])]?.missions || []).length > 0 || Object.values(weekData).some(d => d.missions.length > 0) ? (
                            // Show mission breakdown
                            (() => {
                              const allMissionIds = new Set<string>();
                              Object.values(weekData).forEach((d) => {
                                d.missions.forEach((m) => allMissionIds.add(m.missionId));
                              });
                              return Array.from(allMissionIds).map((mId) => {
                                const mission = getMission(mId);
                                if (!mission) return null;
                                return (
                                  <tr key={`${cId}-${mId}`} className="border-b border-border bg-muted/20">
                                    <td className="px-4 py-1.5 pl-12">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${poleColors[mission.pole]}`}>
                                          {mission.pole}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{mission.client}</span>
                                      </div>
                                    </td>
                                    {displayedWeeks.map((w, i) => {
                                      const wk = weekKey(w);
                                      const entry = weekData[wk]?.missions.find((m) => m.missionId === mId);
                                      return (
                                        <td key={i} className="text-center px-1 py-1">
                                          {entry && entry.days > 0 ? (
                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${poleBgColors[mission.pole]}`}>
                                              {entry.days.toFixed(1)}j
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground/20 text-[10px]">—</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              });
                            })()
                          ) : null}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
};

// Need React import for Fragment
import React from "react";

export default Forecast;
