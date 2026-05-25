import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Link2, Loader2, CheckCircle, AlertCircle, Save, ChevronDown, ChevronUp } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { Profile } from "@/lib/database.types";

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useNotionSettings() {
  return useQuery({
    queryKey: ["notion_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notion_settings")
        .select("*")
        .single();
      if (error) throw error;
      return data as {
        database_id: string | null;
        prop_names: Partial<PropNames> | null;
        last_synced_at: string | null;
        transverse_database_id: string | null;
        transverse_prop_names: Partial<TransversePropNames> | null;
        transverse_last_synced_at: string | null;
        proposals_endpoint_url: string | null;
        proposals_last_synced_at: string | null;
      };
    },
    // Refetch toutes les 60s pour rafraîchir "Dernière sync"
    refetchInterval: 60_000,
  });
}

function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PropNames = {
  name: string;
  client: string;
  pole: string;
  budget_days: string;
  start_date: string;
  end_date: string;
  status: string;
  manager: string;
  consultants: string;
  nature_mission: string;
};

const DEFAULT_PROP_NAMES: PropNames = {
  name:           "Nom du projet",
  client:         "Nom du client",
  pole:           "Pôle",
  budget_days:    "Budget jours",
  start_date:     "émission facture acompte",
  end_date:       "émission facture finale",
  status:         "État",
  manager:        "Manager",
  consultants:    "Consultants",
  nature_mission: "Nature_mission",
};

const PROP_LABELS: Record<keyof PropNames, string> = {
  name:           "Nom du projet (titre)",
  client:         "Nom du client",
  pole:           "Pôle",
  budget_days:    "Budget (jours)",
  start_date:     "Date début",
  end_date:       "Date fin",
  status:         "Statut",
  manager:        "Manager",
  consultants:    "Consultants",
  nature_mission: "Nature de la mission",
};

// ─── Projets transverses ─────────────────────────────────────────────────────

type TransversePropNames = {
  name:       string;
  status:     string;
  priority:   string;
  start_date: string;
  end_date:   string;
};

const DEFAULT_TRANSVERSE_PROP_NAMES: TransversePropNames = {
  name:       "Nom du projet",
  status:     "État",
  priority:   "Priorité",
  start_date: "Date de début",
  end_date:   "Date de fin",
};

const TRANSVERSE_PROP_LABELS: Record<keyof TransversePropNames, string> = {
  name:       "Nom du projet (titre)",
  status:     "Statut",
  priority:   "Priorité",
  start_date: "Date début",
  end_date:   "Date fin",
};

// ─── Composant ────────────────────────────────────────────────────────────────

type SyncResult = {
  success: boolean;
  synced: number;
  skipped: number;
  total: number;
  warnings: string[];
  error?: string;
};

const Settings = () => {
  const queryClient = useQueryClient();
  const { data: notionSettings, isLoading: loadingSettings } = useNotionSettings();
  const { data: profiles = [], isLoading: loadingProfiles } = useProfiles();

  const [dbId, setDbId] = useState("");
  const [propNames, setPropNames] = useState<PropNames>(DEFAULT_PROP_NAMES);
  const [showPropNames, setShowPropNames] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Projets transverses
  const [transverseDbId, setTransverseDbId] = useState("");
  const [transversePropNames, setTransversePropNames] = useState<TransversePropNames>(DEFAULT_TRANSVERSE_PROP_NAMES);
  const [showTransversePropNames, setShowTransversePropNames] = useState(false);
  const [savingTransverseConfig, setSavingTransverseConfig] = useState(false);
  const [transverseSyncResult, setTransverseSyncResult] = useState<SyncResult | null>(null);
  const [transverseSyncing, setTransverseSyncing] = useState(false);

  // Propales HubSpot
  const [proposalsUrl, setProposalsUrl] = useState("");
  const [savingProposalsConfig, setSavingProposalsConfig] = useState(false);
  const [proposalsSyncResult, setProposalsSyncResult] = useState<{ success: boolean; synced?: number; closed?: number; skipped?: number; total?: number; error?: string } | null>(null);
  const [proposalsSyncing, setProposalsSyncing] = useState(false);

  // Pré-remplit les champs depuis la BDD
  useEffect(() => {
    if (notionSettings) {
      setDbId(notionSettings.database_id ?? "");
      setPropNames({ ...DEFAULT_PROP_NAMES, ...(notionSettings.prop_names ?? {}) });
      setTransverseDbId(notionSettings.transverse_database_id ?? "");
      setTransversePropNames({ ...DEFAULT_TRANSVERSE_PROP_NAMES, ...(notionSettings.transverse_prop_names ?? {}) });
      setProposalsUrl(notionSettings.proposals_endpoint_url ?? "");
    }
  }, [notionSettings]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    const { error } = await supabase
      .from("notion_settings")
      .update({ database_id: dbId, prop_names: propNames })
      .eq("id", 1);
    setSavingConfig(false);
    if (!error) queryClient.invalidateQueries({ queryKey: ["notion_settings"] });
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-notion");
      if (error) throw error;
      setSyncResult(data as SyncResult);
      // Rafraîchit toutes les queries qui dépendent des missions/assignments/saisies
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["assigned_missions"] });
      queryClient.invalidateQueries({ queryKey: ["all_missions"] });
      queryClient.invalidateQueries({ queryKey: ["manager_dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["mission_detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin_stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin_entries"] });
      queryClient.invalidateQueries({ queryKey: ["consultant_dashboard"] });
    } catch (err: any) {
      setSyncResult({ success: false, synced: 0, skipped: 0, total: 0, warnings: [], error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveTransverseConfig = async () => {
    setSavingTransverseConfig(true);
    const { error } = await supabase
      .from("notion_settings")
      .update({ transverse_database_id: transverseDbId, transverse_prop_names: transversePropNames })
      .eq("id", 1);
    setSavingTransverseConfig(false);
    if (!error) queryClient.invalidateQueries({ queryKey: ["notion_settings"] });
  };

  const handleTransverseSync = async () => {
    setTransverseSyncing(true);
    setTransverseSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-notion-transverse");
      if (error) throw error;
      setTransverseSyncResult(data as SyncResult);
      queryClient.invalidateQueries({ queryKey: ["transverse_projects"] });
      queryClient.invalidateQueries({ queryKey: ["notion_settings"] });
    } catch (err: any) {
      setTransverseSyncResult({ success: false, synced: 0, skipped: 0, total: 0, warnings: [], error: err.message });
    } finally {
      setTransverseSyncing(false);
    }
  };

  const handleSaveProposalsConfig = async () => {
    setSavingProposalsConfig(true);
    const { error } = await supabase
      .from("notion_settings")
      .update({ proposals_endpoint_url: proposalsUrl })
      .eq("id", 1);
    setSavingProposalsConfig(false);
    if (!error) queryClient.invalidateQueries({ queryKey: ["notion_settings"] });
  };

  const handleProposalsSync = async () => {
    setProposalsSyncing(true);
    setProposalsSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-hubspot-deals");
      if (error) throw error;
      setProposalsSyncResult(data);
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      queryClient.invalidateQueries({ queryKey: ["notion_settings"] });
    } catch (err: any) {
      setProposalsSyncResult({ success: false, error: err.message });
    } finally {
      setProposalsSyncing(false);
    }
  };

  const updateUserRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  });

  return (
    <AppLayout>
      <h2 className="text-xl font-heading font-semibold text-primary mb-6">Paramètres</h2>

      {/* ── Notion Sync ── */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={20} className="text-secondary" />
          <h3 className="font-heading font-semibold text-primary">Synchronisation Notion</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Notion est la source de vérité pour les missions. La synchronisation importe les missions,
          managers et consultants affectés depuis ta base Notion.
        </p>

        <div className="mb-4">
          <label className="label-uppercase block mb-1.5">Database ID</label>
          <Input
            value={dbId}
            onChange={(e) => setDbId(e.target.value)}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="bg-card border-input max-w-md"
          />
          <p className="text-xs text-muted-foreground mt-2">
            La clé API Notion est désormais stockée côté serveur (Edge Function secret <code className="font-mono">NOTION_API_KEY</code>). Elle nest plus modifiable depuis cette page.
          </p>
        </div>

        {/* Mapping des colonnes Notion */}
        <button
          type="button"
          onClick={() => setShowPropNames((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          {showPropNames ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Noms des colonnes dans Notion
        </button>

        {showPropNames && (
          <div className="grid grid-cols-3 gap-3 mb-4 p-4 bg-muted/40 rounded-lg border border-border">
            <p className="col-span-3 text-xs text-muted-foreground mb-1">
              Renseigne le nom exact de chaque colonne tel qu'il apparaît dans ta base Notion.
            </p>
            {(Object.keys(DEFAULT_PROP_NAMES) as (keyof PropNames)[]).map((key) => (
              <div key={key}>
                <label className="label-uppercase block mb-1">{PROP_LABELS[key]}</label>
                <Input
                  value={propNames[key]}
                  onChange={(e) => setPropNames((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="bg-card border-input text-sm h-8"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            className="rounded-lg border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
            onClick={handleSaveConfig}
            disabled={savingConfig}
          >
            {savingConfig
              ? <Loader2 size={14} className="mr-2 animate-spin" />
              : <Save size={14} className="mr-2" />
            }
            Enregistrer
          </Button>

          <Button
            className="rounded-lg"
            onClick={handleSync}
            disabled={syncing || !dbId}
          >
            {syncing
              ? <><Loader2 size={14} className="mr-2 animate-spin" />Synchronisation…</>
              : <><RefreshCw size={14} className="mr-2" />Synchroniser depuis Notion</>
            }
          </Button>

          {notionSettings?.last_synced_at && (
            <span className="text-xs text-muted-foreground ml-auto">
              Dernière sync : {formatDistanceToNow(new Date(notionSettings.last_synced_at), { addSuffix: true, locale: fr })}
            </span>
          )}
        </div>

        {/* Résultat de la sync */}
        {syncResult && (
          <div className={`p-4 rounded-lg text-sm ${syncResult.success ? "bg-secondary/10" : "bg-destructive/10"}`}>
            {syncResult.success ? (
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-secondary mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-secondary">
                    Synchronisation réussie — {syncResult.synced} mission{syncResult.synced > 1 ? "s" : ""} importée{syncResult.synced > 1 ? "s" : ""}
                  </span>
                  {syncResult.skipped > 0 && (
                    <p className="text-muted-foreground mt-1">{syncResult.skipped} entrée(s) ignorée(s) (titre vide)</p>
                  )}
                  {syncResult.warnings.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-amber-600">Avertissements :</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5">
                        {syncResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                      <p className="text-xs text-muted-foreground mt-2">
                        Ces utilisateurs n'ont pas encore de compte sur Releaf Time. Crée-les dans "Gestion des utilisateurs" ci-dessous.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                <span className="text-destructive">{syncResult.error ?? "Erreur inconnue"}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
          <strong>Depuis Notion :</strong> missions (nom, client, pôle, budget, dates, statut), managers, consultants affectés.
          <br />
          <strong>Stocké en propre :</strong> saisies de temps, calculs, alertes budget.
        </div>
      </div>

      {/* ── Notion Sync — Projets transverses ── */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={20} className="text-secondary" />
          <h3 className="font-heading font-semibold text-primary">Synchronisation Notion — Projets transverses</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Base Notion qui alimente la section <em>Projets transverses</em> dans la grille de saisie.
          Utilise la même clé API Notion que pour les missions.
        </p>

        <div className="mb-4">
          <label className="label-uppercase block mb-1.5">Database ID</label>
          <Input
            value={transverseDbId}
            onChange={(e) => setTransverseDbId(e.target.value)}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="bg-card border-input max-w-md"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Pense à <strong>partager la base Notion</strong> avec l'intégration via le menu <code>•••</code> → <code>Connections</code>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowTransversePropNames((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          {showTransversePropNames ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Noms des colonnes dans Notion
        </button>

        {showTransversePropNames && (
          <div className="grid grid-cols-3 gap-3 mb-4 p-4 bg-muted/40 rounded-lg border border-border">
            <p className="col-span-3 text-xs text-muted-foreground mb-1">
              Renseigne le nom exact de chaque colonne tel qu'il apparaît dans ta base Notion.
            </p>
            {(Object.keys(DEFAULT_TRANSVERSE_PROP_NAMES) as (keyof TransversePropNames)[]).map((key) => (
              <div key={key}>
                <label className="label-uppercase block mb-1">{TRANSVERSE_PROP_LABELS[key]}</label>
                <Input
                  value={transversePropNames[key]}
                  onChange={(e) => setTransversePropNames((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="bg-card border-input text-sm h-8"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            className="rounded-lg border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
            onClick={handleSaveTransverseConfig}
            disabled={savingTransverseConfig}
          >
            {savingTransverseConfig
              ? <Loader2 size={14} className="mr-2 animate-spin" />
              : <Save size={14} className="mr-2" />
            }
            Enregistrer
          </Button>

          <Button
            className="rounded-lg"
            onClick={handleTransverseSync}
            disabled={transverseSyncing || !transverseDbId}
          >
            {transverseSyncing
              ? <><Loader2 size={14} className="mr-2 animate-spin" />Synchronisation…</>
              : <><RefreshCw size={14} className="mr-2" />Synchroniser depuis Notion</>
            }
          </Button>

          {notionSettings?.transverse_last_synced_at && (
            <span className="text-xs text-muted-foreground ml-auto">
              Dernière sync : {formatDistanceToNow(new Date(notionSettings.transverse_last_synced_at), { addSuffix: true, locale: fr })}
            </span>
          )}
        </div>

        {transverseSyncResult && (
          <div className={`p-4 rounded-lg text-sm ${transverseSyncResult.success ? "bg-secondary/10" : "bg-destructive/10"}`}>
            {transverseSyncResult.success ? (
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-secondary mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-secondary">
                    Synchronisation réussie — {transverseSyncResult.synced} projet{transverseSyncResult.synced > 1 ? "s" : ""} importé{transverseSyncResult.synced > 1 ? "s" : ""}
                  </span>
                  {transverseSyncResult.skipped > 0 && (
                    <p className="text-muted-foreground mt-1">{transverseSyncResult.skipped} entrée(s) ignorée(s) (titre vide)</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                <span className="text-destructive">{transverseSyncResult.error ?? "Erreur inconnue"}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── HubSpot Sync — Propositions commerciales ── */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={20} className="text-secondary" />
          <h3 className="font-heading font-semibold text-primary">Synchronisation HubSpot — Propositions commerciales</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Endpoint REST de l'app HubSpot Dashboard qui expose les propales en cours.
          Le token Bearer est stocké côté serveur (Edge Function secret <code className="font-mono">HUBSPOT_DASHBOARD_TOKEN</code>).
          Sync auto toutes les 10 min.
        </p>

        <div className="mb-4">
          <label className="label-uppercase block mb-1.5">URL de l'endpoint</label>
          <Input
            value={proposalsUrl}
            onChange={(e) => setProposalsUrl(e.target.value)}
            placeholder="https://hubspot-dashboard-xxx.onrender.com/api/deals/full"
            className="bg-card border-input max-w-2xl"
          />
        </div>

        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            className="rounded-lg border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
            onClick={handleSaveProposalsConfig}
            disabled={savingProposalsConfig}
          >
            {savingProposalsConfig
              ? <Loader2 size={14} className="mr-2 animate-spin" />
              : <Save size={14} className="mr-2" />
            }
            Enregistrer
          </Button>

          <Button
            className="rounded-lg"
            onClick={handleProposalsSync}
            disabled={proposalsSyncing || !proposalsUrl}
          >
            {proposalsSyncing
              ? <><Loader2 size={14} className="mr-2 animate-spin" />Synchronisation…</>
              : <><RefreshCw size={14} className="mr-2" />Synchroniser depuis HubSpot</>
            }
          </Button>

          {notionSettings?.proposals_last_synced_at && (
            <span className="text-xs text-muted-foreground ml-auto">
              Dernière sync : {formatDistanceToNow(new Date(notionSettings.proposals_last_synced_at), { addSuffix: true, locale: fr })}
            </span>
          )}
        </div>

        {proposalsSyncResult && (
          <div className={`p-4 rounded-lg text-sm ${proposalsSyncResult.success ? "bg-secondary/10" : "bg-destructive/10"}`}>
            {proposalsSyncResult.success ? (
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-secondary mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-secondary">
                    Synchronisation réussie — {proposalsSyncResult.synced} propale{(proposalsSyncResult.synced ?? 0) > 1 ? "s" : ""} active{(proposalsSyncResult.synced ?? 0) > 1 ? "s" : ""}
                  </span>
                  {(proposalsSyncResult.closed ?? 0) > 0 && (
                    <p className="text-muted-foreground mt-1">{proposalsSyncResult.closed} propale(s) marquée(s) Gagné/Perdu (retirée(s) de la grille)</p>
                  )}
                  {(proposalsSyncResult.skipped ?? 0) > 0 && (
                    <p className="text-muted-foreground mt-1">{proposalsSyncResult.skipped} entrée(s) ignorée(s)</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                <span className="text-destructive">{proposalsSyncResult.error ?? "Erreur inconnue"}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Gestion utilisateurs ── */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-heading font-semibold text-primary text-sm">Gestion des utilisateurs</h3>
          <p className="text-xs text-muted-foreground">Crée les comptes via Supabase Authentication</p>
        </div>

        {loadingProfiles ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-secondary" size={20} />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 label-uppercase">Nom</th>
                <th className="text-left px-4 py-3 label-uppercase">Email</th>
                <th className="text-left px-4 py-3 label-uppercase">Rôle</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateUserRole.mutate({ id: u.id, role: e.target.value })}
                      className="text-xs font-medium px-2 py-1 rounded border border-input bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="consultant">Consultant</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
};

export default Settings;
