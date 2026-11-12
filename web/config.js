// Indirizzo dell'archivio e chiave pubblica.
// La chiave pubblica è fatta per stare nella pagina: da sola non dà accesso ai dati,
// che restano protetti dall'accesso obbligatorio e dalle regole di sicurezza sulle righe.
export const CONFIG = {
  url: 'https://wldcetatyaxanvalmlpt.supabase.co',
  chiavePubblica: 'sb_publishable_FGrSSSBcWq6hJRty_AOfrw_lBb2ZdPJ',
  permessiGoogle: [
    'https://www.googleapis.com/auth/calendar.app.created',
    'https://www.googleapis.com/auth/calendar.freebusy',
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  ].join(' '),
};
