-- Pagina del progetto modificabile: ogni blocco ha una misura, e oltre alle schede esistono le note libere.

alter table public.schede
  add column tipo text not null default 'scheda' check (tipo in ('scheda', 'nota')),
  add column testo text not null default '',
  -- larghezza in dodicesimi della pagina; altezza in punti. Vuoto = misura automatica.
  add column larghezza smallint check (larghezza between 2 and 12),
  add column altezza integer check (altezza between 80 and 4000);

-- Misure dei riquadri fissi in alto (mission, vision, obiettivi, micro-obiettivi, indicatori).
alter table public.progetti
  add column disposizione jsonb not null default '{}'::jsonb;
