## Gioco "Crea la tua bowl" – Frontend

App web Svelte + Vite per il gioco sulle scelte alimentari e le emissioni di CO₂, pensata per essere ospitata su GitHub Pages e collegata a Supabase.

### Requisiti

- Node.js LTS
- Account Supabase con un progetto configurato (lo schema viene creato tramite MCP, ma puoi anche applicare manualmente la migrazione descritta in `regole-bowl-game.md` se necessario).

### Installazione

```bash
cd frontend
npm install
```

### Variabili d'ambiente

Nel file `frontend/.env` (non commitare questo file) definisci:

```bash
VITE_SUPABASE_URL=la_tua_url_supabase
VITE_SUPABASE_ANON_KEY=la_tua_chiave_anon
VITE_TEACHER_PIN=il_tuo_pin_docente
```

### Comandi di sviluppo

- `npm run dev` – avvia il server di sviluppo Vite
- `npm run build` – build di produzione
- `npm run preview` – anteprima della build

### Struttura principale

- `src/App.svelte` – entry point con:
  - landing (scelta docente / partecipante),
  - area docente (creazione sessione, fasi, riepilogo di classe),
  - flusso studente (Fase 1 e Fase 2).
- `src/lib/supabaseClient.ts` – client Supabase condiviso.
- `src/lib/types.ts` – tipi TypeScript per sessioni, partecipanti, ingredienti e bowl.
- `src/lib/api.ts` – wrapper per leggere/scrivere su Supabase.

Per dettagli sulle regole del gioco e sugli obiettivi didattici vedi i file `regole-bowl-game.md` e `requisiti-contesto.md` nella root del repository.
