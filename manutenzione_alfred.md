# Manutenzione di Alfred

Aggiornato: 11 novembre 2026.

## Da cosa dipende

| Cosa | Uso | Costo |
|---|---|---|
| Supabase, piano gratuito | Archivio, accesso, funzione riservata | 0 € |
| GitHub Pages | Pubblicazione della pagina | 0 € |
| Google Calendar API | Orari occupati e blocchi | 0 € |
| Libreria Supabase 2.119.0 | Copiata in `web/lib/`, non si aggiorna da sola | 0 € |
| Google Apps Script | Avviso di pausa (script nell'account dell'utilizzatore) | 0 € |
| puppeteer-core | Solo per le prove, sul Mac | 0 € |

Nessun piano a pagamento attivo. Nessuna carta di pagamento inserita.

## Limiti del piano gratuito da tenere d'occhio

- Supabase mette in pausa un progetto dopo 7 giorni senza attività. Un progetto in pausa si riattiva dal pannello Supabase.
- **Avviso di pausa, attivo dal 12 novembre 2026.** A ogni apertura riuscita (al massimo ogni sei ore per dispositivo) la pagina chiede alla funzione riservata di mandare un segnale a uno script nell'account Google dell'utilizzatore («Alfred avviso pausa», su script.google.com). Ogni mattina alle 8 lo script controlla: se l'ultimo segnale ha cinque giorni o più, manda una sola email all'utilizzatore con oggetto «ATTENZIONE: promemoria scadenza». Il codice dello script è in `avviso/avviso_pausa.gs`. Provato: il segnale arriva e l'ora registrata si aggiorna; l'email di prova è stata eseguita dall'utilizzatore. Non provato: l'email vera al quinto giorno.
- Il piano gratuito consente due progetti attivi: sono occupati entrambi (Contatick e alfred).
- Nessuna copia automatica dei dati: vale solo l'esportazione manuale.

## Come si allinea con Google

- All'apertura della pagina, al ritorno sulla pagina dopo più di cinque minuti, e con «Aggiorna da Google».
- A pagina chiusa non succede nulla: uno spostamento fatto in Google si vede alla prossima apertura.
- Ultimo allineamento riuscito e ultimo errore sono in alto in ogni pagina e in «Dati e collegamenti».

## Problemi noti e limiti

- **L'autorizzazione di Google scade ogni 7 giorni.** L'app Google è rimasta in stato «Test» perché la console non ha consentito di pubblicarla (pulsante «Pubblica app» bloccato). Alla scadenza Alfred mostra che Google va ricollegato: si rientra da «Dati e collegamenti». Resta da risolvere.
- Uno dei 9 calendari dell'account non restituisce gli orari occupati: è «Festività in Italia», un calendario di sola consultazione di Google (accertato l'11 novembre 2026 con l'azione `calendari_non_letti` della funzione). Non contiene impegni: nessun effetto sulle proposte, che però non evitano i giorni festivi.
- Proposta, scrittura, allineamento e spostamento sono provati con Google reale. Non provati con Google reale: blocco rimosso in Google, blocco trasformato in giornata intera, conferma di fine su un blocco davvero terminato (provata solo con un blocco inserito nell'archivio).
- La prova nel browser `pagina.prova.mjs` a volte si interrompe all'avvio per un'attesa scaduta (due volte su una decina di esecuzioni); rieseguita, riesce. Causa non accertata: la prova ora stampa cosa mostra la pagina quando succede.
- Le fasce orarie per le proposte sono scritte in `web/js/proposta.js`: per cambiarle va modificato quel file.
- Pagina del progetto: i blocchi si ridimensionano solo dal Mac; su iPhone stanno in colonna a misura automatica. I blocchi non si incastrano da soli: fra blocchi di altezza diversa possono restare spazi vuoti.
- Abitudini: non hanno promemoria né notifiche e non compaiono nel calendario; l'ordine si cambia solo dal momento della giornata. Le quantità si scrivono con + e −, oppure toccando il numero.
- Su iPhone le attività non si trascinano: si spostano dal campo «Posizione» dentro l'attività. Le schede si spostano con le frecce.
- Eliminare un'attività che ha blocchi in calendario lascia gli eventi in Google senza attività collegata: la pagina avvisa prima.
- Un blocco trasformato in Google in evento di giornata intera viene solo segnalato.
- Segnare un'attività come completata non toglie i suoi blocchi futuri dal calendario.
- Senza rete la pagina si apre ma non salva: non c'è una coda di modifiche da inviare dopo.
- I riepiloghi delle 8:00 e delle 19:00 non esistono.

## Controlli periodici

- Ogni settimana: esportare una copia dei dati.
- Dopo ogni modifica al codice: `npm run prove` e `node prove/pagina.prova.mjs`.
- Dopo modifiche alla funzione `calendario`: `node prove/google.prova.mjs fase1`, spostare a mano in Google Calendar il blocco di prova, poi `fase2` (toglie da sé i dati di prova).
- Ogni tanto: aggiornare l'interfaccia Supabase (installata 2.122, disponibile 3.1).

## Registro delle manutenzioni

- 11 novembre 2026: prima installazione (struttura dei dati, funzione riservata, pagina, pubblicazione).
- 12 novembre 2026: tracker delle abitudini (giorni precisi o volte a settimana, spunta o quantità, serie, calendario del mese); nuovo logo su pagina, iPhone e pulsante della scrivania.
- 12 novembre 2026: pagina del progetto modificabile (blocchi ridimensionabili, note libere), creazione ed eliminazione di progetti, nuove aree Itinerun, Vivi Biohacking e BNI, avviso di pausa attivato, pulsante «Alfred» sulla scrivania, pagina delle norme sulla privacy.
- 11 novembre 2026: credenziali Google caricate, accesso con Google attivato, creato il calendario «Alfred prova», prove con Google reale riuscite. Dati di prova tolti: il calendario è vuoto.
