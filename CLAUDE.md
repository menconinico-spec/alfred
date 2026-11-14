# Alfred: istruzioni operative per Claude Code

Gestionale personale di un solo utilizzatore, non tecnico. Scrivi a lui in italiano semplice, guidandolo un passo per volta quando serve una sua azione. Nomi di file, funzioni e commenti nel codice sono in italiano.

## Cosa c'è

- `web/`: la pagina (HTML, CSS, JavaScript a moduli, nessuno strumento di costruzione). Pubblicata su GitHub Pages dal flusso `.github/workflows/pubblica.yml` a ogni invio che tocca `web/`.
  - `js/fuso.js`, `js/proposta.js`, `js/stato.js`: regole pure (fuso Europe/Rome, proposta di blocco, stati e tempo). Provate da `prove/regole.test.mjs`.
  - `js/abitudini.js`: regole pure delle abitudini (prevista, fatta, serie, andamento del mese). Provate da `prove/abitudini.test.mjs`. Pagina in `js/viste/abitudini.js`; tabelle `abitudini` e `abitudini_registrazioni` (nessuna riga = nessun dato, mai uno zero).
  - `js/finanze.js`: regole pure delle finanze (somme per mese e gestione, crescita, impegni fissi, obiettivi; effettivo e previsto mai sommati, dato mancante = `null`). Provate da `prove/finanze.test.mjs`. Pagina in `js/viste/finanze.js`; testi del percorso a tappe in `js/finanze_percorso.js` (solo metodi pubblicati, nessuna citazione). Tabelle `fin_*`.
  - `js/archivio.js`: unico accesso a Supabase, copia dei dati in memoria, esportazione e ripristino.
  - `js/google.js`: chiamate alla funzione riservata. La pagina non parla mai con Google.
  - `js/viste/`: una pagina per file (`progetto`, `attivita`, `matrice`, `calendario`, `altre`). La pagina del progetto è una tela a 12 colonne: ogni blocco ha larghezza e altezza salvate (`schede.larghezza/altezza`, `progetti.disposizione` per i riquadri fissi); le schede hanno `tipo` `scheda` o `nota`.
  - `lib/supabase.js`: libreria Supabase copiata in locale (versione 2.119.0).
- `finanze/leggi_fogli.py`: legge i fogli «Flusso di cassa <anno>.xlsx» (cartella passata come argomento), fa i conti e con `--invia` sostituisce i movimenti degli anni letti nell'archivio (chiave di servizio da `.env.segreti`; `--utente-prova` per le prove). Lo lancia il comando `/finanze` (in `~/.claude/skills/finanze/`, fuori da questo archivio), che poi scrive il rapporto. I movimenti nascono solo dai fogli: la pagina non li modifica.
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
- Finanze: nessun calcolo di imposte e nessuna aliquota ipotizzata (la percentuale di accantonamento la scrive l'utilizzatore); ricorrenze e righe «Previsto» sono previsioni, mai sommate all'effettivo; nessun pagamento o investimento automatico; i testi sugli autori riassumono metodi pubblicati, senza citazioni, e dichiarano le divergenze.
- Conti, nomi di banche, importi e gestioni dell'utilizzatore stanno solo nell'archivio e nella cartella superiore (`strumenti_finanze/`, `rapporti_finanze/`), mai in questo codice.
- Niente AI dentro la pagina, Telegram o agenti che girano da soli: sono evoluzioni future, da non costruire senza incarico. L'unico agente è il comando `/finanze`, che parte a richiesta in Claude Code.

## Comandi

```
npm run prove                      # regole di calcolo
npm run pagina                     # pagina in locale su http://127.0.0.1:8765/
node prove/pagina.prova.mjs        # prove nel browser (serve la pagina in locale, oppure ALFRED_PAGINA=<indirizzo>); la prova 14 usa python3 con openpyxl
node prove/google.prova.mjs fase1  # prove con Google reale; poi spostamento a mano in Google e `fase2` (che ripulisce)
supabase db push --linked          # applica nuove migrazioni
supabase functions deploy calendario --use-api   # pubblica la funzione (Docker non è installato)
supabase config push               # applica supabase/config.toml (prima esportare GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET da .env.segreti)
```

Limiti dell'ambiente: Docker e Deno non sono installati, quindi la funzione non si prova in locale. L'interfaccia Supabase è alla versione 2.122.

## Salvataggi

Salvataggi piccoli e descritti in italiano. Prima di ogni invio controllare che non entrino segreti o dati personali: l'archivio su GitHub è pubblico.

A fine incremento aggiornare `manutenzione_alfred.md`, `installazione_alfred.md`, `sicurezza_alfred.md` e, nella cartella superiore, `stato_progetto_alfred.md`, descrivendo solo ciò che esiste.
