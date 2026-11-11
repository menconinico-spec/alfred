# Manutenzione di Alfred

Aggiornato: 11 novembre 2026.

## Da cosa dipende

| Cosa | Uso | Costo |
|---|---|---|
| Supabase, piano gratuito | Archivio, accesso, funzione riservata | 0 € |
| GitHub Pages | Pubblicazione della pagina | 0 € |
| Google Calendar API | Orari occupati e blocchi | 0 € |
| Libreria Supabase 2.119.0 | Copiata in `web/lib/`, non si aggiorna da sola | 0 € |
| puppeteer-core | Solo per le prove, sul Mac | 0 € |

Nessun piano a pagamento attivo. Nessuna carta di pagamento inserita.

## Limiti del piano gratuito da tenere d'occhio

- Supabase mette in pausa un progetto dopo 7 giorni senza attività. **Non esiste ancora nessun avviso automatico**: è stato proposto, non attivato. Finché non c'è, aprire Alfred almeno una volta a settimana. Un progetto in pausa si riattiva dal pannello Supabase.
- Il piano gratuito consente due progetti attivi: sono occupati entrambi (Contatick e alfred).
- Nessuna copia automatica dei dati: vale solo l'esportazione manuale.

## Come si allinea con Google

- All'apertura della pagina, al ritorno sulla pagina dopo più di cinque minuti, e con «Aggiorna da Google».
- A pagina chiusa non succede nulla: uno spostamento fatto in Google si vede alla prossima apertura.
- Ultimo allineamento riuscito e ultimo errore sono in alto in ogni pagina e in «Dati e collegamenti».

## Problemi noti e limiti

- Collegamento a Google non ancora configurato: proposta di blocco, scrittura, allineamento e spostamenti **non sono ancora provati con Google reale**.
- Le fasce orarie per le proposte sono scritte in `web/js/proposta.js`: per cambiarle va modificato quel file.
- Su iPhone le attività non si trascinano: si spostano dal campo «Posizione» dentro l'attività. Le schede si spostano con le frecce.
- Eliminare un'attività che ha blocchi in calendario lascia gli eventi in Google senza attività collegata: la pagina avvisa prima.
- Un blocco trasformato in Google in evento di giornata intera viene solo segnalato.
- Segnare un'attività come completata non toglie i suoi blocchi futuri dal calendario.
- Senza rete la pagina si apre ma non salva: non c'è una coda di modifiche da inviare dopo.
- I riepiloghi delle 8:00 e delle 19:00 non esistono.
- L'accesso da app installata su iPhone non è ancora stato provato su un iPhone vero.

## Controlli periodici

- Ogni settimana: esportare una copia dei dati.
- Dopo ogni modifica al codice: `npm run prove` e `node prove/pagina.prova.mjs`.
- Ogni tanto: aggiornare l'interfaccia Supabase (installata 2.122, disponibile 3.1).

## Registro delle manutenzioni

- 11 novembre 2026: prima installazione (struttura dei dati, funzione riservata, pagina, pubblicazione).
