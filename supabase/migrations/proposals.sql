-- Propositions commerciales (propales) : 4e source de saisies de temps.
-- Alimentée par l'API HubSpot Dashboard (autre app Vercel) via l'Edge Function sync-hubspot-deals.
-- Les deals "Gagné" / "Perdu" ne sont jamais renvoyés par l'API → on les marque 'closed' à la sync
-- quand ils disparaissent de la réponse.

-- ── 1. Table proposals ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_id    text UNIQUE NOT NULL,                  -- clé d'upsert depuis HubSpot
  name          text NOT NULL,                         -- nom prospect (metadata.proposal_nom > deal.name)
  mission_type  text,                                  -- metadata.proposal_mission
  stage         text,                                  -- libellé HubSpot ("RDV Propale", "Négociation"...)
  amount        numeric,                               -- montant EUR
  probability   numeric,                               -- % associé au stage
  close_date    date,                                  -- date de clôture prévue
  status        text NOT NULL DEFAULT 'active'         -- 'active' (présent dans l'API) | 'closed' (disparu)
                CHECK (status IN ('active', 'closed')),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),    -- dernière sync où on l'a vu
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposals_status_idx ON public.proposals (status);
CREATE INDEX IF NOT EXISTS proposals_hubspot_id_idx ON public.proposals (hubspot_id);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read proposals" ON public.proposals;
CREATE POLICY "Authenticated read proposals"
  ON public.proposals FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin write proposals" ON public.proposals;
CREATE POLICY "Admin write proposals"
  ON public.proposals FOR ALL
  USING (public.current_user_role() = 'admin');

-- ── 2. Table de jointure user_proposals ──────────────────────────────────────
-- Persiste le fait qu'un user a "ajouté" une propale à sa grille, même sans saisie d'heures.
-- Sans ça, une propale ajoutée mais à 0h disparaîtrait à la prochaine session.
CREATE TABLE IF NOT EXISTS public.user_proposals (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_id  uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, proposal_id)
);

ALTER TABLE public.user_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User manages own user_proposals" ON public.user_proposals;
CREATE POLICY "User manages own user_proposals"
  ON public.user_proposals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Colonne proposal_id sur time_entries ──────────────────────────────────
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS time_entries_proposal_idx
  ON public.time_entries (proposal_id);

-- ── 4. Extension de notion_settings (réutilisé comme "integrations settings") ─
-- URL stockée ici (publique), token stocké comme secret côté Edge Function.
ALTER TABLE public.notion_settings
  ADD COLUMN IF NOT EXISTS proposals_endpoint_url text,
  ADD COLUMN IF NOT EXISTS proposals_last_synced_at timestamptz;
