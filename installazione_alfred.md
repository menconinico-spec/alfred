# Installazione di Alfred

Aggiornato: 11 novembre 2026.

## Dove si trova

- Pagina: https://menconinico-spec.github.io/alfred/
- Codice sul Mac: cartella `Progetto Alfred AI/Alfred`
- Codice in rete: https://github.com/menconinico-spec/alfred (pubblico)
- Archivio: Supabase, progetto «alfred» (https://supabase.com/dashboard/project/wldcetatyaxanvalmlpt)
- Chiavi: file `.env.segreti` nella cartella `Alfred`, non copiato in rete

## Usare Alfred

- Mac: aprire l'indirizzo della pagina in Chrome o Safari. In Chrome si può installare come app dal menu del browser.
- Mac, dalla scrivania: doppio clic su «Alfred» (`Alfred.app`), che apre la pagina in una finestra propria di Chrome. Si ricrea con `zsh app-mac/crea_app.sh [immagine dell'icona]`.
- iPhone: aprire l'indirizzo in Safari, premere Condividi, poi «Aggiungi alla schermata Home».
- Accesso: «Accedi con Google», con l'unico account ammesso. Provato dal Mac l'11 novembre 2026. Provato anche dall'app aggiunta alla schermata Home di un iPhone: l'utilizzatore ha confermato l'11 novembre 2026 che l'accesso funziona.
- Finanze: i fogli stanno in Lavoro → Documenti → Flusso di cassa («Flusso di cassa <anno>.xlsx»). Per farli leggere: aprire Claude Code sul Mac e scrivere `/finanze`. Il comando sta in `~/.claude/skills/finanze/`, il programma in `finanze/leggi_fogli.py` (serve python3 con openpyxl). I fogli vuoti di un nuovo anno si creano con `python3 ../strumenti_finanze/crea_fogli.py "<cartella>" <anno>` (non sovrascrive file esistenti).
- Google mostra l'avviso «app non verificata»: è atteso, l'app è privata.
- Ogni 7 giorni Google chiede di rifare il collegamento, perché l'app Google è in stato «Test» (vedi manutenzione).

## Collegare Google (fatto l'11 novembre 2026; qui come promemoria)

1. Nella console Google Cloud: creare il progetto, attivare «Google Calendar API», configurare la schermata di consenso, aggiungere il proprio indirizzo fra gli utenti di prova, creare il client web con indirizzo di ritorno `https://wldcetatyaxanvalmlpt.supabase.co/auth/v1/callback`.
2. Incollare ID client e segreto client nelle due righe vuote di `.env.segreti`.
3. Claude Code li carica in Supabase: `supabase secrets set` per la funzione e `supabase config push` per l'accesso con Google.
4. Primo accesso dalla pagina: Google chiede tre permessi e Alfred crea il calendario «Alfred prova».

## Copia di sicurezza e ripristino

- «Dati e collegamenti», «Esporta i dati»: scarica `alfred-copia-AAAA-MM-GG.json`, un file di testo leggibile con progetti, obiettivi, schede, attività, blocchi, tempi e cronologia. Non contiene chiavi.
- «Ripristina da una copia…»: mostra un'anteprima, poi aggiunge le righe mancanti e riporta quelle esistenti ai valori della copia. Non elimina nulla e non tocca Google Calendar. La cronologia non viene ripristinata.
- Provato l'11 novembre 2026: cancellata una scheda con attività, blocchi e tempi, tutto è tornato dalla copia.
- Il piano gratuito di Supabase non fa copie automatiche: esportare con regolarità. La pagina avvisa se da quel dispositivo non si scarica una copia da sette giorni.

## Trasferire su un altro Mac

1. Installare git, Node e l'interfaccia Supabase.
2. Scaricare il codice da GitHub.
3. Copiare a mano `.env.segreti` dal vecchio Mac (non è in rete).
4. `supabase login`, poi `supabase link --project-ref wldcetatyaxanvalmlpt`.

Per il solo uso non serve nulla di tutto questo: basta l'indirizzo della pagina.

## Ricostruire da zero

1. Creare un nuovo progetto Supabase e applicare `supabase/migrations/` con `supabase db push`.
2. Pubblicare la funzione: `supabase functions deploy calendario --use-api`.
3. Applicare le impostazioni: `supabase config push`.
4. Aggiornare indirizzo e chiave pubblica in `web/config.js`.
5. Creare l'unico utente e ripristinare i dati dall'ultima copia esportata.

Questa procedura non è stata provata per intero.

## Annullare ciò che è stato creato

| Cosa | Come si annulla |
|---|---|
| Pagina pubblicata | GitHub, archivio `alfred`, Settings, Pages: disattivare. Oppure eliminare l'archivio |
| Archivio Supabase | Pannello Supabase, progetto «alfred», Impostazioni, «Delete project». Prima esportare i dati |
| Collegamento a Google | myaccount.google.com/permissions, voce «Alfred», rimuovere l'accesso |
| Progetto Google Cloud | Console Google Cloud, impostazioni del progetto «Alfred», «Arresta» |
| Calendario «Alfred prova» | Si elimina da Google Calendar, impostazioni del calendario. **Da non eliminare senza autorizzazione dell'utilizzatore** |
| Avviso di pausa | Su script.google.com aprire «Alfred avviso pausa», eseguire `disinstalla`, poi eliminare il progetto |
| Pulsante sulla scrivania | Spostare `Alfred.app` nel Cestino |
| Codice sul Mac | Eliminare la cartella `Alfred` |
