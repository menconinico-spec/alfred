// Percorso a tappe delle finanze: testi di educazione finanziaria.
// Regole di scrittura: solo metodi pubblicati dagli autori, riassunti con parole nostre; nessuna frase fra virgolette
// attribuita a qualcuno; dove gli autori non concordano, lo si dice; motivazione e convinzioni personali sono
// indicate come tali. Non sono consulenza fiscale, legale o di investimento.

export const STATI_TAPPA = [['da_iniziare', 'Da iniziare'], ['in_corso', 'In corso'], ['fatta', 'Fatta']];

export const AVVERTENZA = 'Questi testi sono educazione finanziaria: riassumono metodi pubblicati, non sono consulenza fiscale, legale o di investimento. Le imposte le calcola il commercialista. Alfred non esegue pagamenti né investimenti.';

export const TAPPE = [
  {
    chiave: 'controllo',
    titolo: '1. Sapere dove vanno i soldi',
    perche: 'Senza numeri veri ogni scelta è a sensazione. Questa tappa non chiede di spendere meno: chiede di vedere tutto.',
    passi: [
      'Compilare i fogli «Flusso di cassa» ogni settimana, anche con cifre piccole.',
      'Scrivere in «Ricorrenti» tutte le spese fisse, comprese quelle annuali.',
      'Leggere i fogli con il comando /finanze almeno una volta al mese e guardare le categorie più pesanti.',
    ],
    metodi: [
      { autori: 'George S. Clason, «L\'uomo più ricco di Babilonia»', testo: 'Fra le sue regole c\'è tenere sotto controllo le spese, distinguendo quelle necessarie dai desideri, così che resti sempre una parte di ciò che si guadagna.' },
      { autori: 'Dave Ramsey, «The Total Money Makeover»', testo: 'Propone un bilancio «a base zero»: a inizio mese ogni euro di entrata riceve una destinazione, fino ad arrivare a zero euro non assegnati.' },
      { autori: 'Ramit Sethi, «I Will Teach You to Be Rich»', testo: 'Propone un «piano di spesa consapevole» in quattro grandi voci (costi fissi, investimenti, risparmi, spese libere) e trasferimenti automatici fra conti, invece di contare ogni singola spesa.' },
    ],
    divergenze: 'Ramsey vuole un controllo voce per voce e l\'uso dei contanti; Sethi ritiene più efficace curare poche scelte grandi e automatizzare il resto, e mette l\'accento sull\'aumentare le entrate più che sul tagliare le piccole spese.',
  },
  {
    chiave: 'debiti',
    titolo: '2. Rimettere i debiti',
    perche: 'Le rate tolgono margine ogni mese. Per scegliere un ordine servono, per ogni debito, residuo, rata e tasso scritti nel contratto.',
    passi: [
      'Scrivere in «Debiti» tutti i debiti, anche quelli verso persone, con residuo, rata e tasso.',
      'Scegliere un ordine di estinzione e mantenerlo; pagare sempre almeno la rata su tutti.',
      'Destinare al debito scelto ogni somma in più che si libera.',
    ],
    metodi: [
      { autori: 'Dave Ramsey', testo: 'Metodo «a palla di neve»: si elencano i debiti dal residuo più piccolo al più grande e si chiude prima il più piccolo, senza guardare il tasso. Il vantaggio dichiarato è la motivazione: si vedono presto debiti chiusi.' },
      { autori: 'Metodo «a valanga» (descritto, fra gli altri, da Ramit Sethi accanto a quello di Ramsey)', testo: 'Si chiude prima il debito con il tasso più alto. A parità di versamenti è l\'ordine che fa pagare meno interessi.' },
      { autori: 'George S. Clason', testo: 'Nel racconto delle tavolette d\'argilla il protagonista vive con sette decimi delle entrate, ne tiene un decimo per sé e ne destina due decimi ai creditori, con cui concorda un piano.' },
      { autori: 'Robert Kiyosaki, «Padre ricco padre povero»', testo: 'Distingue il debito usato per comprare beni che producono entrate da quello usato per i consumi, e considera accettabile solo il primo.' },
    ],
    divergenze: 'Ramsey rifiuta ogni debito, compresi quelli che Kiyosaki chiama «buoni». Sull\'ordine, palla di neve e valanga danno spesso risultati diversi: la prima punta sulla costanza, la seconda sul costo. Clason continua a mettere da parte un decimo anche mentre paga i debiti; Ramsey invece sospende risparmi e investimenti, salvo un piccolo fondo, finché i debiti non sono chiusi.',
  },
  {
    chiave: 'tasse',
    titolo: '3. Mettere da parte per imposte e contributi',
    perche: 'Con entrate variabili le scadenze arrivano quando i soldi sono già stati usati. Serve una regola fissa a ogni incasso.',
    passi: [
      'Chiedere al commercialista quale percentuale di ogni incasso accantonare e il calendario delle scadenze dell\'anno.',
      'Scrivere quella percentuale qui sotto: Alfred la usa solo per ricordarla, non calcola imposte.',
      'A ogni incasso spostare subito l\'IVA e la quota per le imposte nelle tasche dedicate.',
      'Scrivere in «Ricorrenti» le scadenze note, con l\'importo comunicato dal commercialista.',
    ],
    metodi: [
      { autori: 'Ramit Sethi', testo: 'Il principio dei trasferimenti automatici verso conti separati, ciascuno con uno scopo, si applica bene all\'accantonamento: la quota esce dal conto corrente prima di poter essere spesa.' },
    ],
    divergenze: 'Gli autori dell\'elenco scrivono per altri paesi e altri regimi fiscali: su quanto accantonare vale solo l\'indicazione del commercialista.',
  },
  {
    chiave: 'fondo',
    titolo: '4. Costruire il fondo d\'emergenza',
    perche: 'Un imprevisto senza riserva diventa un nuovo debito.',
    passi: [
      'Aprire un obiettivo «Fondo d\'emergenza» nella Panoramica, con una prima cifra piccola.',
      'Tenerlo su un conto separato da quello delle spese.',
      'Chiusi i debiti, portarlo ad alcuni mesi di spese.',
    ],
    metodi: [
      { autori: 'Dave Ramsey', testo: 'Nei suoi «piccoli passi» il primo è un fondo iniziale ridotto (negli Stati Uniti indica 1.000 dollari) prima di attaccare i debiti; dopo i debiti il fondo va portato a tre-sei mesi di spese.' },
      { autori: 'George S. Clason', testo: 'La prima regola è tenere per sé almeno un decimo di tutto ciò che si guadagna, sempre.' },
      { autori: 'Robert Kiyosaki', testo: 'Riprende il principio di «pagare prima se stessi»: la quota da mettere da parte si toglie all\'inizio, non con quello che avanza.' },
    ],
    divergenze: 'Quanto fondo prima dei debiti: Ramsey lo vuole piccolo per concentrare tutto sui debiti; chi segue la regola del decimo continua a risparmiare in parallelo. Con entrate variabili un fondo più ampio riduce il rischio di nuove rate, ma allunga i tempi dei debiti.',
  },
  {
    chiave: 'entrate',
    titolo: '5. Aumentare le entrate',
    perche: 'Con entrate basse tagliare non basta. Questa tappa procede insieme alle altre, non dopo.',
    passi: [
      'Seguire nella Panoramica la media delle entrate rispetto agli obiettivi mensili.',
      'Per ogni gestione decidere un\'azione commerciale misurabile a settimana.',
      'Registrare le fatture non incassate come «Previsto» con la data attesa, e sollecitarle quando compaiono fra quelle scadute.',
    ],
    metodi: [
      { autori: 'Alex Hormozi, «$100M Offers» e «$100M Leads»', testo: 'Lavorare sull\'offerta aumentandone il valore percepito (risultato desiderato e probabilità di ottenerlo, a fronte di tempo e fatica richiesti) e poi sui contatti: persone che già ti conoscono, contatti a freddo, contenuti, pubblicità.' },
      { autori: 'Dan Lok, «Unlock It»', testo: 'Mette al centro le competenze ad alto reddito, come la vendita di servizi di valore elevato.' },
      { autori: 'MJ DeMarco, «The Millionaire Fastlane»', testo: 'Sostiene che il reddito vada slegato dal tempo costruendo un\'attività che risponde a un bisogno reale, che si controlla e che può crescere senza la propria presenza.' },
      { autori: 'Naval Ravikant', testo: 'Sostiene che non ci si arricchisce affittando il proprio tempo: servono quote di proprietà e leve, cioè persone, capitale e soprattutto prodotti che si replicano senza costo, come software e contenuti.' },
      { autori: 'Robert Kiyosaki, «I quadranti del cashflow»', testo: 'Descrive il passaggio da dipendente e autonomo a titolare di un\'impresa che funziona senza di lui e a investitore.' },
    ],
    divergenze: 'Hormozi e Lok partono dal vendere di più e meglio oggi; DeMarco, Ravikant e Kiyosaki guardano alla struttura, perché un reddito legato alle proprie ore ha un tetto. Le due cose non si escludono, ma chiedono tempi e rischi diversi.',
  },
  {
    chiave: 'investimenti',
    titolo: '6. Investire e avvicinarsi alla libertà finanziaria',
    perche: 'È l\'ultima tappa: prima vengono controllo, debiti, accantonamenti e riserva. L\'obiettivo di libertà finanziaria si misura con entrate che non dipendono dal proprio tempo.',
    passi: [
      'Aprire un obiettivo per le entrate slegate dal tempo e aggiornarlo a mano.',
      'Prima di ogni investimento scrivere costo, rischio, liquidità, tempo richiesto e quanto è reversibile.',
      'Studiare prima di impegnare denaro; nessuna somma che serve a debiti, imposte o riserva.',
    ],
    metodi: [
      { autori: 'Warren Buffett, lettere agli azionisti di Berkshire Hathaway', testo: 'A chi non investe di mestiere consiglia da anni fondi indicizzati a basso costo, tenuti a lungo.' },
      { autori: 'Ray Dalio', testo: 'Mette al centro la diversificazione fra investimenti che si comportano in modo diverso l\'uno dall\'altro. Una versione semplificata del suo portafoglio è riportata da Tony Robbins in «Money: Master the Game».' },
      { autori: 'Tony Robbins, «Money: Master the Game»', testo: 'Insiste sul destinare in automatico una percentuale fissa delle entrate e sul peso dei costi di gestione nel lungo periodo.' },
      { autori: 'Robert Kiyosaki, MJ DeMarco', testo: 'Puntano su beni e attività che producono entrate (immobili, imprese) più che sull\'accumulo lento in strumenti finanziari.' },
      { autori: 'Napoleon Hill, Wallace D. Wattles, Bob Proctor, Joe Vitale, Lain García Calvo', testo: 'Scrivono di scopo definito, fiducia e atteggiamento mentale. Scrivere l\'obiettivo, rileggerlo, praticare gratitudine e visualizzazione possono essere esercizi personali utili alla costanza: sono convinzioni e motivazione, non meccanismi dimostrati di arricchimento.' },
    ],
    divergenze: 'Buffett e Ramsey indicano un accumulo paziente in fondi; DeMarco critica proprio quella strada perché richiede decenni, e con Kiyosaki preferisce costruire attività. Dalio aggiunge che nessuno sa prevedere quale investimento andrà meglio. Chi promette risultati certi non ha il sostegno di nessuno di questi metodi.',
  },
];

export const NON_USATI = 'Dell\'elenco iniziale non sono usati qui Alfio Bardolla, Ivan Nossa, Elon Musk, Donald Trump, Silvio Berlusconi e Andrea Pontremoli: Alfred non dispone di un loro metodo di finanza personale da riassumere con sicurezza, e non attribuisce consigli a memoria.';
