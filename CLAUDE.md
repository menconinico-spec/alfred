# Alfred: istruzioni operative per Claude Code

Gestionale personale di un solo utilizzatore, non tecnico. Scrivi a lui in italiano semplice, guidandolo un passo per volta quando serve una sua azione. Nomi di file, funzioni e commenti nel codice sono in italiano.

## Cosa c'è

- `web/`: la pagina (HTML, CSS, JavaScript a moduli, nessuno strumento di costruzione). Pubblicata su GitHub Pages dal flusso `.github/workflows/pubblica.yml` a ogni invio che tocca `web/`.
  - `js/fuso.js`, `js/proposta.js`, `js/stato.js`: regole pure (fuso Europe/Rome, proposta di blocco, stati e tempo). Provate da `prove/regole.test.mjs`.
  - `js/abitudini.js`: regole pure delle abitudini (prevista, fatta, serie, andamento del mese). Provate da `prove/abitudini.test.mjs`. Pagina in `js/viste/abitudini.js`; tabelle `abitudini` e `abitudini_registrazioni` (nessuna riga = nessun dato, mai uno zero).
  - `js/archivio.js`: unico accesso a Supabase, copia dei dati in memoria, esportazione e ripristino.
  - `js/google.js`: chiamate alla funzione riservata. La pagina non parla mai con Google.
  - `js/viste/`: una pagina per file (`progetto`, `attivita`, `matrice`, `calendario`, `altre`). La pagina del progetto è una tela a 12 colonne: ogni blocco ha larghezza e altezza salvate (`schede.larghezza/altezza`, `progetti.disposizione` per i riquadri fissi); le schede hanno `tipo` `scheda` o `nota`.
  - `lib/supabase.js`: libreria Supabase copiata in locale (versione 2.119.0).
- `supabase/migrations/`: struttura dei dati e regole di sicurezza sulle righe.
- `supabase/functions/calendario/`: unica funzione riservata; è il solo punto che contatta Google Calendar.
- `avviso/avviso_pausa.gs`: script dell'avviso di pausa, installato a mano dall'utilizzatore su script.google.com. Riceve il segnale dall'azione `segnale` della funzione riservata (indirizzo nel segreto `AVVISO_PAUSA_URL`).
- `app-mac/crea_app.sh`: crea `Alfred.app` sulla scrivania.
- `supabase/config.toml`: impostazioni di accesso (indirizzi ammessi, iscrizioni disattivate).
- `prove/`: prove automatiche. I risultati (immagini, copia di prova) vanno in `prove/risultati/`, escluso dal versionamento.
- `.env.segreti`: chiavi locali, escluso dal versionamento. Non stamparne mai il contenuto.

## Regole che non si toccano senza una decisione dell'utilizzatore

- Si scrive solo sul calendario creato dalla funzione (`Alfred prova`). L'identificativo del calendario non arriva mai dalla pagina.
- Degli altri calendari si leggono solo gli orari occupati (`freeBusy`): niente titoli, niente dettagli.
- Orario e durata dei blocchi: fa fede Google. Aree, schede, attività, stato e tempo effettivo: fa fede l'archivio.
- La fine di un blocco non completa l'attività. Il tempo effettivo esiste solo se confermato a mano. Nessuno zero al posto di un dato mancante.
- Stato di esecuzione (`attivita.stato`) e pianificazione (ricavata dai blocchi in `stato.js`) restano separati. «Da pianificare» è una vista, non una cancellazione.
- Nessuna sovrascrittura silenziosa: uno spostamento da Alfred usa `If-Match`; in caso di conflitto si recepisce Google e si avvisa.
- Nessun segreto nel codice o nei messaggi. Nessun dato reale nelle prove: utente di prova separato, eliminato a fine prova.
- Niente AI, Telegram, modulo economico o agenti: sono evoluzioni future, da non costruire senza incarico.

## Comandi

```
npm run prove                      # regole di calcolo
npm run pagina                     # pagina in locale su http://127.0.0.1:8765/
node prove/pagina.prova.mjs        # prove nel browser (serve la pagina in locale, oppure ALFRED_PAGINA=<indirizzo>)
node prove/google.prova.mjs fase1  # prove con Google reale; poi spostamento a mano in Google e `fase2` (che ripulisce)
supabase db push --linked          # applica nuove migrazioni
supabase functions deploy calendario --use-api   # pubblica la funzione (Docker non è installato)
supabase config push               # applica supabase/config.toml (prima esportare GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET da .env.segreti)
```

Limiti dell'ambiente: Docker e Deno non sono installati, quindi la funzione non si prova in locale. L'interfaccia Supabase è alla versione 2.122.

## Salvataggi

Salvataggi piccoli e descritti in italiano. Prima di ogni invio controllare che non entrino segreti o dati personali: l'archivio su GitHub è pubblico.

A fine incremento aggiornare `manutenzione_alfred.md`, `installazione_alfred.md`, `sicurezza_alfred.md` e, nella cartella superiore, `stato_progetto_alfred.md`, descrivendo solo ciò che esiste.
