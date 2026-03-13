<script lang="ts">
  import { onMount } from 'svelte'
  import { createSession, countParticipants, deleteSession, fetchClassSummary, fetchOpenSessions, fetchSession, finalizeSessionAndAssignNumbers, resetSession, updateSessionPhase } from './api'
  import type { ClassSummaryRow } from './api'
  import type { Session } from './types'

  let session: Session | null = null
  let isLoading = false
  let errorMessage = ''
  let participantCount = 0
  let summary: ClassSummaryRow[] = []
  let isFinalized = false

  let openSessions: Session[] = []
  let loadingOpen = false

  const STORAGE_KEY = 'teacher_active_session_id'

  function saveSessionToStorage(s: Session | null) {
    if (s) {
      localStorage.setItem(STORAGE_KEY, s.id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  async function restoreSession(sessionId: string) {
    try {
      isLoading = true
      const s = await fetchSession(sessionId)
      session = s
      saveSessionToStorage(s)
      participantCount = await countParticipants(s.id)
      isFinalized = s.phase === 3
      if (isFinalized) {
        summary = await fetchClassSummary(s.id)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      isLoading = false
    }
  }

  async function loadOpenSessions() {
    try {
      loadingOpen = true
      openSessions = await fetchOpenSessions()
    } catch (error) {
      console.error(error)
    } finally {
      loadingOpen = false
    }
  }

  onMount(async () => {
    const savedId = localStorage.getItem(STORAGE_KEY)
    if (savedId) {
      await restoreSession(savedId)
    }
    await loadOpenSessions()
  })

  async function handleCreateSession() {
    try {
      isLoading = true
      errorMessage = ''
      session = await createSession()
      saveSessionToStorage(session)
      participantCount = 0
      await loadOpenSessions()
    } catch (error) {
      errorMessage = 'Errore nella creazione della sessione.'
      console.error(error)
    } finally {
      isLoading = false
    }
  }

  async function handleRejoinSession(s: Session) {
    await restoreSession(s.id)
  }

  async function handleDeleteSession(s: Session) {
    if (!window.confirm(`Eliminare la sessione ${s.code}? Tutti i dati (partecipanti, bowl) saranno cancellati definitivamente.`)) return
    try {
      isLoading = true
      await deleteSession(s.id)
      if (session?.id === s.id) {
        session = null
        saveSessionToStorage(null)
        isFinalized = false
        participantCount = 0
        summary = []
      }
      await loadOpenSessions()
    } catch (error) {
      console.error(error)
      errorMessage = 'Errore durante l\'eliminazione della sessione.'
    } finally {
      isLoading = false
    }
  }

  async function refreshCounts() {
    if (!session) return
    try {
      participantCount = await countParticipants(session.id)
    } catch (error) {
      console.error(error)
    }
  }

  async function setPhase(phase: 1 | 2) {
    if (!session) return
    try {
      isLoading = true
      await updateSessionPhase(session.id, phase)
      session = { ...session, phase }
    } catch (error) {
      console.error(error)
    } finally {
      isLoading = false
    }
  }

  function handleNewSession() {
    if (!window.confirm('Vuoi creare una nuova sessione? La sessione corrente rimarrà nel database ma non sarà più visualizzata qui.')) return
    session = null
    saveSessionToStorage(null)
    isFinalized = false
    participantCount = 0
    summary = []
    errorMessage = ''
  }

  async function handleResetSession() {
    if (!session) return
    if (!window.confirm('Sei sicuro di voler resettare la sessione? Tutte le scelte dei partecipanti saranno azzerate e si tornerà alla Fase 1.')) return
    try {
      isLoading = true
      errorMessage = ''
      await resetSession(session.id)
      session = { ...session, phase: 1 }
      isFinalized = false
      summary = []
    } catch (error) {
      console.error(error)
      errorMessage = 'Errore durante il reset della sessione.'
    } finally {
      isLoading = false
    }
  }

  async function handleFinalize() {
    if (!session) return
    try {
      isLoading = true
      errorMessage = ''
      await finalizeSessionAndAssignNumbers(session.id)
      session = { ...session, phase: 3 }
      summary = await fetchClassSummary(session.id)
      isFinalized = true
    } catch (error) {
      console.error(error)
      errorMessage = 'Errore durante la conclusione della sessione.'
    } finally {
      isLoading = false
    }
  }

  function phaseLabel(phase: number): string {
    if (phase === 1) return 'Fase 1 – Scelte alla cieca'
    if (phase === 2) return 'Fase 2 – Scelte consapevoli'
    return 'Fase 3 – Confronto finale'
  }

  function formatDiff(value: number): { text: string; isPositive: boolean } {
    const text = value > 0 ? '+' + value : String(value)
    return { text, isPositive: value > 0 }
  }
</script>

{#if session}
  <div class="session-card">
    <p class="label">Codice sessione</p>
    <p class="code">{session.code}</p>
    <p class="hint">Condividi questo codice con la classe.</p>

    <div class="row">
      <button on:click={refreshCounts}>Aggiorna partecipanti</button>
      <p class="meta">Partecipanti collegati: <strong>{participantCount}</strong></p>
    </div>

    <div class="row phases">
      <p class="meta">
        Fase corrente:
        <strong>
          {session.phase === 1 ? 'Scelte alla cieca' : session.phase === 2 ? 'Scelte consapevoli' : 'Confronto finale'}
        </strong>
      </p>
      <div class="buttons">
        <button on:click={() => setPhase(1)} disabled={isLoading || session.phase !== 1}>Fase 1</button>
        <button on:click={() => setPhase(2)} disabled={isLoading || session.phase !== 1}>
          Passa alla Fase 2
        </button>
        <button class="primary" on:click={handleFinalize} disabled={isLoading || isFinalized}>
          Concludi e assegna numeri
        </button>
      </div>
    </div>

    <div class="row session-actions">
      <button class="danger" on:click={handleResetSession} disabled={isLoading}>
        Resetta sessione
      </button>
      <button on:click={handleNewSession} disabled={isLoading}>
        Nuova sessione
      </button>
    </div>

    {#if isFinalized && summary.length > 0}
      <div class="summary">
        <h3>Riepilogo di classe</h3>
        <p class="meta">
          Ogni riga è un partecipante anonimo con il proprio numero. Usa questi numeri se qualcuno vuole farsi
          riconoscere.
        </p>

        <div class="table">
          <div class="header row">
            <span>#</span>
            <span>Bowl 1 (gCO₂eq / km)</span>
            <span>Bowl 2 (gCO₂eq / km)</span>
            <span>Differenza gCO₂eq</span>
          </div>
          {#each summary as row}
            <div class="row">
              <span>{row.participantNumber ?? '–'}</span>
              <span>
                {#if row.bowl1}
                  {row.bowl1.total_co2_g} · {row.bowl1.total_km.toFixed(1)}
                {:else}
                  –
                {/if}
              </span>
              <span>
                {#if row.bowl2}
                  {row.bowl2.total_co2_g} · {row.bowl2.total_km.toFixed(1)}
                {:else}
                  –
                {/if}
              </span>
              <span>
                {#if row.bowl1 && row.bowl2}
                  {@html (function() { const diff = formatDiff(row.bowl2.total_co2_g - row.bowl1.total_co2_g); const className = diff.isPositive ? 'diff-positive' : 'diff-negative'; return '<strong class="' + className + '">' + diff.text + '</strong>' })()}
                {:else}
                  –
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

{#if errorMessage}
  <p class="error">{errorMessage}</p>
{/if}

<div class="open-sessions">
  <div class="open-sessions-header">
    <h3>Sessioni</h3>
    <button class="primary" on:click={handleCreateSession} disabled={isLoading}>
      {isLoading ? 'Creo…' : '+ Nuova sessione'}
    </button>
  </div>

  {#if loadingOpen}
    <p class="hint">Caricamento sessioni…</p>
  {:else if openSessions.length === 0}
    <p class="hint">Nessuna sessione trovata. Creane una nuova.</p>
  {:else}
    <div class="session-list">
      {#each openSessions as s}
        <div class="session-item" class:active={session?.id === s.id}>
          <button class="session-item-main" on:click={() => handleRejoinSession(s)} disabled={isLoading || session?.id === s.id}>
            <span class="session-code">{s.code}</span>
            <span class="session-phase">{phaseLabel(s.phase)}</span>
            <span class="session-date">{new Date(s.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </button>
          <button class="delete-btn" on:click|stopPropagation={() => handleDeleteSession(s)} disabled={isLoading} title="Elimina sessione">
            ✕
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .primary {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    border: none;
    border-radius: 999px;
    padding: 0.75rem 1.4rem;
    font-weight: 600;
    cursor: pointer;
  }

  .primary:disabled {
    opacity: 0.7;
    cursor: default;
  }

  button {
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.7);
    padding: 0.65rem 1.3rem;
    font-size: 0.95rem;
    background: white;
    cursor: pointer;
  }

  button:hover:enabled {
    background: #f9fafb;
  }

  .session-card {
    margin-top: 0.75rem;
    padding: 1.25rem 1.4rem;
    border-radius: 1.25rem;
    background: #f9fafb;
    border: 1px solid rgba(148, 163, 184, 0.5);
  }

  .label {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
    margin-bottom: 0.15rem;
  }

  .code {
    font-size: 1.7rem;
    font-weight: 700;
    letter-spacing: 0.24em;
    margin: 0;
  }

  .hint {
    margin-top: 0.4rem;
    font-size: 0.9rem;
    color: #4b5563;
  }

  .row {
    margin-top: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .meta {
    font-size: 0.95rem;
    color: #4b5563;
  }

  .phases {
    justify-content: space-between;
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .session-actions {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px dashed rgba(148, 163, 184, 0.6);
    gap: 0.5rem;
  }

  .danger {
    border-radius: 999px;
    border: 1px solid rgba(220, 38, 38, 0.5);
    padding: 0.65rem 1.3rem;
    font-size: 0.95rem;
    background: white;
    color: #b91c1c;
    cursor: pointer;
  }

  .danger:hover:enabled {
    background: #fef2f2;
  }

  .error {
    margin-top: 0.75rem;
    color: #b91c1c;
    font-size: 0.9rem;
  }

  .summary {
    margin-top: 1.4rem;
    padding-top: 1rem;
    border-top: 1px dashed rgba(148, 163, 184, 0.8);
  }

  .summary h3 {
    margin-top: 0;
    margin-bottom: 0.3rem;
  }

  .table {
    margin-top: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.9rem;
  }

  .table .row {
    display: grid;
    grid-template-columns: 0.6fr 1.1fr 1.1fr 1fr;
    gap: 0.75rem;
    align-items: center;
  }

  .header {
    font-weight: 600;
    color: #4b5563;
  }

  /* Open sessions list — always visible */
  .open-sessions {
    margin-top: 1.5rem;
    width: 100%;
  }

  .open-sessions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .open-sessions h3 {
    margin: 0;
    font-size: 1.05rem;
  }

  .session-list {
    margin-top: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .session-item {
    display: flex;
    align-items: center;
    gap: 0;
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.5);
    background: #f9fafb;
    overflow: hidden;
  }

  .session-item.active {
    border-color: #22c55e;
    background: #f0fdf4;
  }

  .session-item-main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    padding: 0.7rem 1rem;
    border: none;
    border-radius: 0;
    background: transparent;
    cursor: pointer;
    text-align: left;
    font-size: 0.92rem;
  }

  .session-item-main:disabled {
    cursor: default;
    opacity: 1;
  }

  .session-item-main:hover:enabled {
    background: #f1f5f9;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.4rem;
    height: 100%;
    min-height: 2.6rem;
    padding: 0;
    border: none;
    border-left: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 0;
    background: transparent;
    color: #9ca3af;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .delete-btn:hover:enabled {
    background: #fef2f2;
    color: #b91c1c;
  }

  .session-code {
    font-weight: 700;
    letter-spacing: 0.12em;
    min-width: 5rem;
  }

  .session-phase {
    flex: 1;
    color: #4b5563;
    font-size: 0.85rem;
  }

  .session-date {
    color: #9ca3af;
    font-size: 0.82rem;
    white-space: nowrap;
  }

  /* Difference colors */
  :global(.diff-positive) {
    color: #16a34a;
    font-weight: 600;
  }

  :global(.diff-negative) {
    color: #dc2626;
    font-weight: 600;
  }
</style>
