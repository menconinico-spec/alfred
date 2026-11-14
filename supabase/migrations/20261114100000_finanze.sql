-- Finanze: conti, spese ed entrate ricorrenti (previsioni), debiti, obiettivi, movimenti letti dai fogli.
-- Un importo non noto resta vuoto (null): mai uno zero al posto di un dato mancante.

create table public.fin_conti (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  -- 'conto': conto vero e proprio. 'tasca': suddivisione interna di un conto.
  tipo text not null default 'conto' check (tipo in ('conto', 'tasca')),
  dentro_id uuid references public.fin_conti(id) on delete set null,
  scopo text not null default '',
  saldo numeric,          -- scritto a mano; vuoto = non indicato
  saldo_al date,
  archiviato boolean not null default false,
  posizione integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Una ricorrenza è una previsione, non la prova di un pagamento.
create table public.fin_ricorrenze (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  verso text not null default 'uscita' check (verso in ('uscita', 'entrata')),
  importo numeric not null check (importo > 0),
  cadenza text not null default 'mensile' check (cadenza in ('mensile', 'annuale')),
  mese smallint check (mese between 1 and 12),   -- solo per le annuali
  giorno smallint check (giorno between 1 and 31),
  gestione text not null default '',
  categoria text not null default '',
  inizio date,
  fine date,
  nota text not null default '',
  archiviata boolean not null default false,
  posizione integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create table public.fin_debiti (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  creditore text not null default '',
  residuo numeric check (residuo >= 0),   -- vuoto = non indicato
  residuo_al date,
  rata numeric check (rata > 0),          -- rata mensile; vuoto = non indicata
  tasso numeric check (tasso >= 0),       -- tasso annuo in percento, come da contratto; vuoto = non indicato
  ultima_rata date,
  nota text not null default '',
  estinto boolean not null default false,
  posizione integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create table public.fin_obiettivi (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  -- 'entrate_mensili': entrate effettive al mese (confrontate con i fogli). 'importo': una cifra da raggiungere, seguita a mano.
  tipo text not null default 'entrate_mensili' check (tipo in ('entrate_mensili', 'importo')),
  importo numeric not null check (importo > 0),
  gestioni text[] not null default '{}',  -- vuoto = tutte le gestioni
  entro date,
  raggiunto numeric,                      -- solo per 'importo': quanto c'è oggi, scritto a mano
  nota text not null default '',
  posizione integer not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Ogni lettura dei fogli lascia una riga: quando, quali file, quante righe, quali avvisi.
create table public.fin_letture (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  letto_il timestamptz not null default now(),
  file text[] not null default '{}',
  anni smallint[] not null default '{}',
  righe integer not null default 0,
  avvisi jsonb not null default '[]',
  creato_il timestamptz not null default now()
);

-- Movimenti letti dai fogli. A ogni lettura quelli degli anni letti vengono sostituiti: nessun doppione.
create table public.fin_movimenti (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lettura_id uuid not null references public.fin_letture(id) on delete cascade,
  anno smallint not null,
  mese smallint not null check (mese between 1 and 12),
  gestione text not null,
  riga integer not null,
  data date,
  descrizione text not null default '',
  categoria text not null default '',
  entrata numeric,
  uscita numeric,
  conto text not null default '',
  stato text not null default '',
  previsto boolean not null default false,
  creato_il timestamptz not null default now()
);
create index on public.fin_movimenti (anno, mese);

-- Una sola riga per utilizzatore: stato delle tappe del percorso e percentuale di accantonamento indicata da lui.
create table public.fin_impostazioni (
  id uuid primary key default gen_random_uuid(),
  proprietario uuid not null default auth.uid() references auth.users(id) on delete cascade unique,
  tappe jsonb not null default '{}',
  accantonamento_percento numeric check (accantonamento_percento between 0 and 100),
  accantonamento_nota text not null default '',
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create trigger aggiorna_fin_conti before update on public.fin_conti for each row execute function public.tocca_aggiornato_il();
create trigger aggiorna_fin_ricorrenze before update on public.fin_ricorrenze for each row execute function public.tocca_aggiornato_il();
create trigger aggiorna_fin_debiti before update on public.fin_debiti for each row execute function public.tocca_aggiornato_il();
create trigger aggiorna_fin_obiettivi before update on public.fin_obiettivi for each row execute function public.tocca_aggiornato_il();
create trigger aggiorna_fin_impostazioni before update on public.fin_impostazioni for each row execute function public.tocca_aggiornato_il();

do $$
declare t text;
begin
  foreach t in array array['fin_conti', 'fin_ricorrenze', 'fin_debiti', 'fin_obiettivi', 'fin_letture', 'fin_movimenti', 'fin_impostazioni'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy solo_proprietario on public.%I for all to authenticated using (proprietario = (select auth.uid())) with check (proprietario = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
