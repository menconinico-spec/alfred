"""Crea un foglio «Flusso di cassa <anno>.xlsx» con dati fittizi per le prove. Uso: python3 foglio_finto.py <cartella> <anno>"""
import sys, os, datetime
from openpyxl import Workbook

MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
COLONNE = ['Data', 'Descrizione', 'Categoria', 'Entrata (€)', 'Uscita (€)', 'Conto', 'Stato']
cartella, anno = sys.argv[1], int(sys.argv[2])
# mese → gestione → righe (giorno, descrizione, categoria, entrata, uscita, conto, stato)
DATI = {
    1: {'Alfa (prova)': [(10, 'Consulenza finta', 'Consulenze', 100.10, None, 'Conto finto', 'Incassato'),
                         (12, 'Provvigione finta', 'Vendite', 200.20, None, 'Conto finto', ''),
                         (20, 'Fattura finta non incassata', 'Vendite', 500, None, '', 'Previsto')],
        'Beta (prova)': [(15, 'Spesa finta', 'Strumenti', None, 40, 'Conto finto', 'Pagato')]},
    2: {'Alfa (prova)': [(5, 'Consulenza finta', 'Consulenze', '450,45 €', None, '', 'Incassato'),
                         (None, 'Riga senza importo', '', None, None, '', '')],
        'Beta (prova)': [(28, 'Spesa prevista finta', 'Strumenti', None, 15, '', 'Previsto'),
                         (30, 'Data impossibile', '', None, 'dieci', '', 'Pagato')]},
    3: {'Alfa (prova)': [(3, 'Consulenza finta', 'Consulenze', 600, None, '', 'Incassato')]},
}
wb = Workbook(); wb.remove(wb.active)
for n, mese in enumerate(MESI, 1):
    ws = wb.create_sheet(mese)
    ws['A1'] = f'Flusso di cassa: {mese} {anno}'
    ws.append([]); ws.append(['Esempio di riga (non entra nei totali):'])
    ws.append(['15/01', 'Esempio', 'Consulenze', 50, None, 'Conto', 'Incassato'])
    ws['A6'] = 'Riepilogo del mese'; ws['A7'] = 'Gestione'; ws['D7'] = 'Entrate effettive'
    riga = 14
    for gestione in ('Alfa (prova)', 'Beta (prova)'):
        ws.cell(row=riga, column=1, value=gestione)
        for c, v in enumerate(COLONNE, 1):
            ws.cell(row=riga + 1, column=c, value=v)
        for i, (g, *resto) in enumerate(DATI.get(n, {}).get(gestione, [])):
            data = None if g is None else (f'{g}/{n:02d}' if g == 30 and n == 2 else datetime.date(anno, n, g))
            for c, v in enumerate([data, *resto], 1):
                ws.cell(row=riga + 2 + i, column=c, value=v)
        riga += 43
wb.save(os.path.join(cartella, f'Flusso di cassa {anno}.xlsx'))
