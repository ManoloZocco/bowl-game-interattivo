<script lang="ts">
  import TeacherPanel from './lib/TeacherPanel.svelte'
  import JoinPanel from './lib/JoinPanel.svelte'
  import StudentBowl from './lib/StudentBowl.svelte'
  import type { Participant, Session } from './lib/types'

  type View = 'landing' | 'teacher' | 'join' | 'student'

  let view: View = 'landing'
  let activeSession: Session | null = null
  let activeParticipant: Participant | null = null
  let teacherAuthenticated = false
  let teacherPinInput = ''
  let teacherPinError = ''

  const TEACHER_PIN = import.meta.env.VITE_TEACHER_PIN as string | undefined

  function openTeacherArea() {
    if (!TEACHER_PIN) {
      // se non è definito alcun PIN, si entra direttamente (utile in sviluppo)
      teacherAuthenticated = true
      view = 'teacher'
      return
    }
    teacherAuthenticated = false
    teacherPinInput = ''
    teacherPinError = ''
    view = 'teacher'
  }

  function checkTeacherPin() {
    if (!TEACHER_PIN) {
      teacherAuthenticated = true
      return
    }
    if (teacherPinInput === TEACHER_PIN) {
      teacherAuthenticated = true
      teacherPinError = ''
    } else {
      teacherAuthenticated = false
      teacherPinError = 'PIN non corretto.'
    }
  }
</script>

<main class="app">
  {#if view === 'landing'}
    <section class="hero">
      <div>
        <h1>Crea la tua bowl</h1>
        <p class="subtitle">Gioco interattivo su sostenibilità e impatto climatico delle scelte alimentari.</p>

        <div class="actions">
          <button class="primary" on:click={openTeacherArea}>Sono un docente</button>
          <button class="secondary" on:click={() => (view = 'join')}>Partecipa a una sessione</button>
        </div>
      </div>
    </section>
  {:else if view === 'teacher'}
    <section class="panel">
      <button class="back" on:click={() => (view = 'landing')}>← Torna alla home</button>
      <h2>Area docente</h2>

      {#if !teacherAuthenticated}
        <p>Inserisci il PIN docente per accedere alla creazione e gestione delle sessioni.</p>
        <form
          class="pin-form"
          on:submit|preventDefault={() => {
            checkTeacherPin()
          }}
        >
          <input
            type="password"
            placeholder="PIN docente"
            bind:value={teacherPinInput}
            autocomplete="off"
            required
          />
          <button type="submit" class="primary small">Entra</button>
        </form>
        {#if teacherPinError}
          <p class="error">{teacherPinError}</p>
        {/if}
      {:else}
        <p>
          Qui potrai creare una nuova sessione di gioco, ottenere un codice da condividere con la classe e vedere in
          tempo reale le bowl create dagli studenti.
        </p>
        <TeacherPanel />
      {/if}
    </section>
  {:else if view === 'join'}
    <section class="panel">
      <button class="back" on:click={() => (view = 'landing')}>← Torna alla home</button>
      <h2>Partecipa a una sessione</h2>
      <p>Inserisci il codice fornito dal docente per iniziare a creare la tua bowl.</p>
      <JoinPanel
        on:joined={(e) => {
          activeSession = e.detail.session
          activeParticipant = e.detail.participant
          view = 'student'
        }}
      />
    </section>
  {:else if view === 'student'}
    {#if activeSession && activeParticipant}
      <section class="panel">
        <button class="back" on:click={() => (view = 'landing')}>← Esci</button>
        <h2>Crea la tua bowl</h2>
        <p class="subtitle">
          Stai partecipando alla sessione <strong>{activeSession.code}</strong>. Segui le indicazioni del docente per le
          diverse fasi.
        </p>
        <StudentBowl session={activeSession} participant={activeParticipant} />
      </section>
    {/if}
  {/if}
</main>

<style>
  .app {
    min-height: 100vh;
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at top left, #fef3c7, #fef9c3 30%, #ecfdf5 60%, #e0f2fe);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  }

  .hero,
  .panel {
    max-width: 720px;
    width: 100%;
    background: white;
    border-radius: 1.5rem;
    padding: 2.5rem 2.25rem;
    box-shadow:
      0 18px 45px rgba(15, 23, 42, 0.08),
      0 0 0 1px rgba(148, 163, 184, 0.15);
  }

  h1 {
    font-size: clamp(2.4rem, 3vw, 2.9rem);
    margin-bottom: 0.5rem;
    letter-spacing: -0.04em;
  }

  h2 {
    font-size: 1.8rem;
    margin-bottom: 0.5rem;
    letter-spacing: -0.03em;
  }

  .subtitle {
    font-size: 1.05rem;
    color: #4b5563;
    max-width: 36rem;
  }

  .actions {
    margin-top: 2rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  button {
    border: none;
    border-radius: 999px;
    padding: 0.85rem 1.6rem;
    font-size: 0.98rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 120ms ease,
      box-shadow 120ms ease,
      background-color 120ms ease,
      color 120ms ease;
  }

  .primary {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    box-shadow: 0 10px 25px rgba(22, 163, 74, 0.35);
  }

  .primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 32px rgba(22, 163, 74, 0.4);
  }

  .secondary {
    background: white;
    color: #065f46;
    border: 1px solid rgba(16, 185, 129, 0.5);
  }

  .secondary:hover {
    background: #ecfdf5;
  }

  .back {
    margin-bottom: 1rem;
    background: none;
    border-radius: 999px;
    padding: 0.35rem 0.9rem;
    border: 1px solid rgba(148, 163, 184, 0.7);
    color: #475569;
    box-shadow: none;
  }

  .back:hover {
    background: #f9fafb;
  }

  p {
    color: #4b5563;
    line-height: 1.6;
    margin-top: 0.4rem;
  }

  .pin-form {
    margin-top: 0.75rem;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .pin-form input {
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.9);
    padding: 0.55rem 1rem;
    font-size: 0.96rem;
    min-width: 0;
    flex: 1 1 160px;
  }

  .primary.small {
    padding-inline: 1.1rem;
    padding-block: 0.6rem;
    font-size: 0.9rem;
  }

  .error {
    color: #b91c1c;
    font-size: 0.9rem;
    margin-top: 0.4rem;
  }
</style>
