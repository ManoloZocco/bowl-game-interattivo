<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { createParticipant, getSessionByCode } from './api'
  import type { Participant, Session } from './types'

  const dispatch = createEventDispatcher<{ joined: { session: Session; participant: Participant } }>()

  let code = ''
  let errorMessage = ''
  let isLoading = false

  async function handleJoin(e: Event) {
    e.preventDefault()
    if (!code.trim()) return

    try {
      isLoading = true
      errorMessage = ''
      const session = await getSessionByCode(code)
      if (!session) {
        errorMessage = 'Sessione non trovata. Controlla il codice.'
        return
      }

      const participant = await createParticipant(session.id)
      dispatch('joined', { session, participant })
    } catch (error) {
      console.error(error)
      errorMessage = 'Errore durante la connessione alla sessione.'
    } finally {
      isLoading = false
    }
  }
</script>

<form class="join-form" on:submit|preventDefault={handleJoin}>
  <label for="code">Codice sessione</label>
  <input
    id="code"
    type="text"
    bind:value={code}
    placeholder="Es. ABC12"
    maxlength="8"
    autocomplete="off"
    required
  />

  <button class="primary" type="submit" disabled={isLoading}>
    {isLoading ? 'Connessione in corso…' : 'Entra nella sessione'}
  </button>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
</form>

<style>
  .join-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 320px;
    margin-top: 1rem;
  }

  label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #4b5563;
  }

  input {
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.9);
    padding: 0.6rem 1rem;
    font-size: 1rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

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

  .error {
    color: #b91c1c;
    font-size: 0.9rem;
  }
</style>
