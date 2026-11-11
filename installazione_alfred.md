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
- iPhone: aprire l'indirizzo in Safari, premere Condividi, poi «Aggiungi alla schermata Home».
- Accesso: «Accedi con Google». **Funzionerà dopo l'inserimento delle credenziali Google**, non ancora fatto.

## Collegare Google (da fare una volta)

1. Nella console Google Cloud: creare il progetto, attivare «Google Calendar API», configurare la schermata di consenso, pubblicare l'app, creare il client web con indirizzo di ritorno `https://wldcetatyaxanvalmlpt.supabase.co/auth/v1/callback`.
2. Incollare ID client e segreto client nelle due righe vuote di `.env.segreti`.
3. Claude Code li carica in Supabase (segreti della funzione e accesso con Google).

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
| Codice sul Mac | Eliminare la cartella `Alfred` |
