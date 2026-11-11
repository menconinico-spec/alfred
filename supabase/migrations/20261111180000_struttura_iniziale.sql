-- Alfred, incremento 1: struttura dei dati.
-- Ogni riga appartiene a un proprietario (l'utente che ha fatto l'accesso)
-- e le regole di sicurezza sulle righe lasciano vedere e modificare solo le proprie.

create extension if not exists pgcrypto;

create or replace function public.tocca_aggiornato_il()
returns trigger language plpgsql as $$
begin
  new.aggiornato_il = now();
  return new;
end $$;

-- Progetti (le voci nella parte bassa della barra laterale)
create table public.progetti (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  colore_google smallint not null default 2 check (colore_google between 1 and 11),
  mission text not null default '',
  vision text not null default '',
  limite_ore_settimana numeric,
  posizione integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Obiettivi, micro-obiettivi e indicatori (parte alta della pagina del progetto)
create table public.obiettivi (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  progetto_id uuid not null references public.progetti(id) on delete cascade,
  tipo text not null check (tipo in ('obiettivo','microobiettivo','indicatore')),
  titolo text not null,
  valore_iniziale text not null default '',
  valore_attuale text not null default '',
  valore_desiderato text not null default '',
  scadenza date,
  posizione integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Schede di base, visibili nella pagina del progetto. Quella "fissa" sta a sinistra.
create table public.schede (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  progetto_id uuid not null references public.progetti(id) on delete cascade,
  titolo text not null,
  fissa boolean not null default false,
  posizione integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Schede interne: le colonne che si vedono aprendo una scheda di base
create table public.sottoschede (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scheda_id uuid not null references public.schede(id) on delete cascade,
  titolo text not null,
  posizione integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Attività (tipo 'attivita') e appunti della scheda fissa (tipo 'appunto': processi, idee, link)
create table public.attivita (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sottoscheda_id uuid not null references public.sottoschede(id) on delete cascade,
  tipo text not null default 'attivita' check (tipo in ('attivita','appunto')),
  titolo text not null,
  risultato_atteso text not null default '',
  note text not null default '',
  collegamento text not null default '',
  -- Matrice di Eisenhower: due valori distinti; vuoto = ancora da valutare
  importante boolean,
  urgente boolean,
  -- Stato di esecuzione, separato dalla pianificazione (che si ricava dai blocchi)
  stato text not null default 'da_fare'
    check (stato in ('da_fare','in_corso','in_attesa','completata','annullata')),
  durata_prevista_min integer check (durata_prevista_min is null or durata_prevista_min > 0),
  scadenza date,
  completata_il timestamptz,
  posizione integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Blocchi di calendario. Orario e durata: fa fede Google Calendar.
create table public.blocchi (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  attivita_id uuid not null references public.attivita(id) on delete cascade,
  inizio timestamptz not null,
  fine timestamptz not null,
  stato text not null default 'da_scrivere'
    check (stato in ('da_scrivere','in_calendario','svolto','saltato','rimosso_in_google','annullato')),
  google_evento_id text,
  google_etag text,
  allineato_il timestamptz,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  check (fine > inizio)
);

-- Tempo effettivo: esiste solo se confermato a mano
create table public.registrazioni_tempo (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  attivita_id uuid not null references public.attivita(id) on delete cascade,
  blocco_id uuid unique references public.blocchi(id) on delete set null,
  minuti integer not null check (minuti > 0),
  giorno date not null,
  nota text not null default '',
  creato_il timestamptz not null default now()
);

-- Cronologia delle modifiche rilevanti (compresi gli spostamenti arrivati da Google)
create table public.cronologia (
  id bigint generated always as identity primary key,
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quando timestamptz not null default now(),
  tipo text not null,
  attivita_id uuid references public.attivita(id) on delete set null,
  blocco_id uuid references public.blocchi(id) on delete set null,
  dettaglio jsonb not null default '{}'::jsonb,
  visto boolean not null default false
);

-- Stato della sincronizzazione con Google (scritto solo dalla funzione riservata)
create table public.sincronizzazione (
  proprietario uuid primary key references auth.users(id) on delete cascade,
  calendario_id text,
  calendario_nome text,
  token_sync text,
  ultimo_riuscito timestamptz,
  ultimo_errore text,
  ultimo_errore_il timestamptz
);

-- Chiave di rinnovo di Google: nessuna regola di accesso, quindi la pagina non può leggerla
create table public.google_credenziali (
  proprietario uuid primary key references auth.users(id) on delete cascade,
  chiave_rinnovo text not null,
  aggiornato_il timestamptz not null default now()
);

create index on public.obiettivi (progetto_id);
create index on public.schede (progetto_id);
create index on public.sottoschede (scheda_id);
create index on public.attivita (sottoscheda_id);
create index on public.blocchi (attivita_id);
create index on public.blocchi (google_evento_id);
create index on public.registrazioni_tempo (attivita_id);
create index on public.cronologia (quando desc);

do $$
declare t text;
begin
  foreach t in array array['progetti','obiettivi','schede','sottoschede','attivita','blocchi'] loop
    execute format('create trigger aggiorna_%1$s before update on public.%1$s
                    for each row execute function public.tocca_aggiornato_il()', t);
  end loop;
end $$;

-- Regole di sicurezza sulle righe
alter table public.progetti enable row level security;
alter table public.obiettivi enable row level security;
alter table public.schede enable row level security;
alter table public.sottoschede enable row level security;
alter table public.attivita enable row level security;
alter table public.blocchi enable row level security;
alter table public.registrazioni_tempo enable row level security;
alter table public.cronologia enable row level security;
alter table public.sincronizzazione enable row level security;
alter table public.google_credenziali enable row level security;

do $$
declare t text;
begin
  foreach t in array array['progetti','obiettivi','schede','sottoschede','attivita','blocchi',
                           'registrazioni_tempo','cronologia'] loop
    execute format('create policy solo_proprietario on public.%I for all to authenticated
                    using (proprietario = (select auth.uid()))
                    with check (proprietario = (select auth.uid()))', t);
  end loop;
end $$;

-- Lo stato di sincronizzazione si può solo leggere dalla pagina
create policy solo_lettura_proprietario on public.sincronizzazione for select to authenticated
  using (proprietario = (select auth.uid()));

-- Chi non ha fatto l'accesso non vede nulla
revoke all on all tables in schema public from anon;
revoke all on public.google_credenziali from authenticated;
revoke insert, update, delete on public.sincronizzazione from authenticated;
