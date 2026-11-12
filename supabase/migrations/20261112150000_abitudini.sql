-- Tracker delle abitudini: comportamenti ricorrenti, distinti dalle attività dei progetti.

create table public.abitudini (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  segno text not null default '',
  -- 'giorni': nei giorni indicati (1 = lunedì … 7 = domenica). 'volte_settimana': un numero di volte a settimana, in giorni liberi.
  frequenza text not null default 'giorni' check (frequenza in ('giorni', 'volte_settimana')),
  giorni smallint[] not null default '{1,2,3,4,5,6,7}',
  volte_settimana smallint not null default 3 check (volte_settimana between 1 and 7),
  -- 'spunta': fatta o non fatta. 'quantita': fatta quando si raggiunge la quantità indicata.
  obiettivo text not null default 'spunta' check (obiettivo in ('spunta', 'quantita')),
  quantita numeric not null default 1 check (quantita > 0),
  unita text not null default '',
  momento text not null default 'qualsiasi' check (momento in ('mattina', 'pomeriggio', 'sera', 'qualsiasi')),
  inizio date not null default current_date,
  nota text not null default '',
  archiviata boolean not null default false,
  posizione integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Una riga per giorno in cui si è registrato qualcosa. Nessuna riga = nessun dato (non «zero»).
create table public.abitudini_registrazioni (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  abitudine_id uuid not null references public.abitudini(id) on delete cascade,
  giorno date not null,
  valore numeric not null check (valore > 0),
  creato_il timestamptz not null default now(),
  unique (abitudine_id, giorno)
);
create index on public.abitudini_registrazioni (giorno);

create trigger aggiorna_abitudini before update on public.abitudini
  for each row execute function public.tocca_aggiornato_il();

alter table public.abitudini enable row level security;
alter table public.abitudini_registrazioni enable row level security;
create policy solo_proprietario on public.abitudini for all to authenticated
  using (proprietario = (select auth.uid())) with check (proprietario = (select auth.uid()));
create policy solo_proprietario on public.abitudini_registrazioni for all to authenticated
  using (proprietario = (select auth.uid())) with check (proprietario = (select auth.uid()));
revoke all on public.abitudini, public.abitudini_registrazioni from anon;
