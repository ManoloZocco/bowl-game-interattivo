## Contesto e obiettivi del software

- **Titolo progetto**: Gioco interattivo "Crea la tua bowl"  
- **Contesto**: attività didattica in scuole secondarie, condotta da Ecodynamics Group (Università di Siena), per esplorare l'impatto climatico delle scelte alimentari.
- **Utenti principali**:
  - Docenti / facilitatori: gestiscono la sessione di gioco in aula.
  - Studenti: partecipano creando le proprie bowl da smartphone o computer.

### Obiettivi educativi

- Far sperimentare in prima persona come le scelte alimentari producano **emissioni di CO₂** diverse.
- Tradurre le emissioni di un pasto in **chilometri percorsi in auto diesel** per rendere l'impatto più intuitivo.
- Mostrare come i comportamenti cambiano quando vengono rese disponibili **informazioni ambientali** (fase cieca vs fase consapevole).
- Stimolare discussioni in classe su **dieta, trasporti e sostenibilità**.

---

## Requisiti funzionali

### 1. Sessioni di gioco

- Il docente può creare una nuova **sessione di classe**:
  - generazione automatica di un **codice breve** (es. `AB3F9`),
  - visualizzazione del numero di partecipanti collegati.
- Gli studenti si collegano inserendo il **codice di sessione**.
- Accesso all'area docente protetto da **PIN** (`VITE_TEACHER_PIN`), configurato lato docente.

### 2. Fasi dell'esperienza

1. **Fase 1 – Scelte alla cieca**
   - Gli studenti creano la propria bowl (dimensione, base, proteine, ingredienti extra) **senza vedere i valori di CO₂**.
   - Il sistema registra le bowl per ogni partecipante.
2. **Fase 2 – Scelte consapevoli**
   - Il docente passa la sessione a Fase 2.
   - Sui dispositivi degli studenti compaiono i **valori di CO₂** dei singoli ingredienti.
   - Ogni studente:
     - vede l'impatto climatico della bowl 1 (gCO₂eq e km auto),
     - può creare una nuova **bowl 2 più sostenibile**.
3. **Fase 3 – Confronto finale**
   - Il docente conclude la sessione: il sistema assegna **numeri anonimi** sequenziali ai partecipanti.
   - Dashboard di classe con, per ciascun numero:
     - bowl 1 e bowl 2,
     - impatto in gCO₂eq e km,
     - differenza tra le due bowl.
   - Utilizzo dei numeri anonimi per la **discussione plenaria**: chi vuole può dichiarare “io sono il n. X”.

### 3. Anonimato e privacy

- Durante Fase 1 e Fase 2:
  - nessun identificativo personale è visibile a docente o studenti,
  - i partecipanti sono solo record anonimi legati a una sessione.
- I numeri di partecipante (1, 2, 3, …) vengono assegnati **solo a fine Fase 2**.
- Lo svelamento dell'identità è **sempre volontario** da parte dello studente.

### 4. Calcolo dell'impatto climatico

- Ogni ingrediente (basi, proteine, extra) ha un valore fisso di **gCO₂eq**.
- L'impatto totale della bowl viene calcolato come somma dei gCO₂eq degli elementi scelti.
- Conversione in chilometri di auto diesel usando il fattore:
  - \( \text{km} = \frac{\text{gCO₂eq}}{130\ \text{gCO₂eq/km}} \).

---

## Requisiti tecnici

- **Frontend**:
  - Svelte + TypeScript + Vite.
  - Single Page Application ospitabile su **GitHub Pages**.
  - UI pensata per:
    - docente con proiettore (dashboard e controllo fasi),
    - studenti su smartphone/PC (schermata di creazione bowl).
- **Backend dati**:
  - **Supabase** (Postgres gestito in cloud).
  - Tabelle principali: `sessions`, `participants`, `ingredients`, `bowls`.
  - Accesso via chiave anonima pubblica, RLS aperte solo per questi record (nessun dato sensibile memorizzato).
- **Configurazione ambiente** (`frontend/.env`, non da commitare):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_TEACHER_PIN`

---

## Considerazioni future (non obbligatorie per la prima versione)

- Aggiunta di grafici di riepilogo (istogrammi, medie per ingrediente, ecc.).
- Possibilità per il docente di esportare i risultati in **CSV** per analisi successive.
- Localizzazione multilingua (es. inglese/italiano).
- Modalità “demo” offline che non richiede Supabase (singola bowl di classe salvata solo in memoria).
