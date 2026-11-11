# Sicurezza di Alfred

Aggiornato: 11 novembre 2026. Descrive solo ciò che esiste. Dove una misura non è ancora stata provata, è scritto.

## Chi può entrare

- Un solo utente nell'archivio. Le nuove iscrizioni sono disattivate: provato, l'archivio dichiara `disable_signup: true`.
- Senza accesso la pagina mostra solo «Accedi con Google» e l'archivio rifiuta ogni lettura (risposta 401, provato).
- L'accesso con Google sarà attivo dopo l'inserimento delle credenziali Google. **Non ancora attivo né provato.**

## Dove stanno i dati

- Archivio: Supabase, progetto «alfred», regione Francoforte, piano gratuito.
- Ogni tabella ha le regole di sicurezza sulle righe attive: ogni riga appartiene a un proprietario e solo lui la legge e la modifica.
- Le prove automatiche usano un utente separato che non vede i dati dell'utilizzatore, e viceversa.

## Dove stanno le chiavi

| Chiave | Dove si trova | Chi la può leggere |
|---|---|---|
| Parola d'ordine dell'archivio, chiave di servizio Supabase | `.env.segreti` nella cartella `Alfred` del Mac | Chi usa il Mac |
| ID client e segreto client di Google | `.env.segreti` e, dopo la configurazione, nei segreti di Supabase | Chi usa il Mac; la funzione riservata |
| Chiave di rinnovo di Google | Tabella `google_credenziali` dell'archivio | Solo la funzione riservata. La pagina non ha il permesso di leggerla |
| Chiave pubblica Supabase | `web/config.js`, visibile a tutti | Chiunque: è fatta per essere pubblica e da sola non apre i dati |

`.env.segreti` è escluso dal controllo di versione e leggibile solo dall'utente del Mac. Un file nascosto non è di per sé una protezione: chi ha accesso al Mac lo può aprire.

## Google Calendar

- Permessi richiesti: elenco dei calendari, orari occupati, gestione dei soli calendari creati da Alfred.
- La funzione riservata scrive solo sul calendario che ha creato lei («Alfred prova») e degli altri chiede solo gli intervalli occupati.
- **Da provare con l'account reale**: che Google rifiuti davvero le scritture fuori da «Alfred prova» con questi permessi.

## Codice pubblico

Il codice è pubblico su GitHub. Non contiene chiavi segrete né dati personali; prima di ogni salvataggio c'è un controllo. Contiene l'indirizzo dell'archivio e la chiave pubblica.

## Rischi residui

- Chi entra nell'account Google dell'utilizzatore entra anche in Alfred.
- Chi ha accesso al Mac può leggere `.env.segreti`. La chiave di servizio scavalca le regole sulle righe.
- La chiave di rinnovo di Google è conservata in chiaro nell'archivio, protetta dai permessi e non da una cifratura aggiuntiva.
- Il piano gratuito di Supabase non fa copie automatiche: l'unica copia è quella esportata a mano.
- La copia esportata è un file in chiaro: va conservata in un posto sicuro.

## Se qualcosa va storto

- Sospetto accesso indesiderato a Google: revocare «Alfred» da myaccount.google.com/permissions, poi ricollegare.
- Chiave di servizio esposta: rigenerarla dal pannello Supabase (Impostazioni del progetto, chiavi API) e aggiornare `.env.segreti`.
- Segreto client di Google esposto: crearne uno nuovo nella console Google Cloud e aggiornarlo nei segreti di Supabase.

## Incidenti

Nessuno registrato.
