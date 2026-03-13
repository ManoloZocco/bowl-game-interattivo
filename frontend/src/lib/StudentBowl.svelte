<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Bowl, Participant, Session } from './types'
  import { BASES, EXTRAS, PROTEINS, computeCo2 } from './ingredients'
  import { fetchParticipantBowls, fetchSession, saveBowl } from './api'

  export let session: Session
  export let participant: Participant

  const DIESEL_CO2_PER_KM = 130

  let liveSession: Session = session
  let pollHandle: number | null = null

  let size: Bowl['size'] = 'regular'
  let baseId = BASES[0]?.id ?? ''
  let selectedProteins: string[] = []
  let selectedExtras: string[] = []

  let isSaving = false
  let summary: Awaited<ReturnType<typeof fetchParticipantBowls>> | null = null
  let errorMessage = ''

  async function refreshSession() {
    try {
      liveSession = await fetchSession(session.id)
      summary = await fetchParticipantBowls(session.id, participant.id)
    } catch (error) {
      console.error(error)
    }
  }

  onMount(() => {
    refreshSession()
    pollHandle = window.setInterval(refreshSession, 5000)
  })

  onDestroy(() => {
    if (pollHandle) window.clearInterval(pollHandle)
  })

  function toggleSelection(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  function currentTotalCo2(): number {
    const ids = [baseId, ...selectedProteins, ...selectedExtras]
    return computeCo2(ids)
  }

  async function handleSaveBowl() {
    if (!baseId || selectedProteins.length === 0) {
      errorMessage = 'Scegli almeno una base e una proteina.'
      return
    }

    errorMessage = ''
    isSaving = true

    try {
      const totalCo2 = currentTotalCo2()
      const km = totalCo2 / DIESEL_CO2_PER_KM

      await saveBowl({
        session_id: session.id,
        participant_id: participant.id,
        phase: liveSession.phase,
        size,
        base_id: baseId,
        protein_ids: selectedProteins,
        ingredient_ids: selectedExtras,
        total_co2_g: totalCo2,
        total_km: km
      })

      await refreshSession()
    } catch (error) {
      console.error(error)
      errorMessage = 'Errore nel salvataggio della bowl.'
    } finally {
      isSaving = false
    }
  }
</script>

<div class="bowl-layout">
  <div class="builder">
    {#if liveSession.phase === 1}
      <h3>Fase 1 – Crea la tua bowl</h3>
      <p class="hint">Scegli liberamente cosa mettere nella bowl. Per ora non vedi l'impatto climatico.</p>
    {:else}
      <h3>Fase 2 – Crea una bowl più consapevole</h3>
      <p class="hint">
        Ora vedi anche l'impatto in gCO₂eq di ogni alimento. Prova a creare una bowl che ti piaccia ma con un impatto
        minore.
      </p>
    {/if}

    <section>
      <h4>1. Dimensione</h4>
      <div class="pill-row">
        <button type="button" class:selected={size === 'regular'} on:click={() => (size = 'regular')}>
          Regular · 1 proteina
        </button>
        <button type="button" class:selected={size === 'large'} on:click={() => (size = 'large')}>
          Large · 2 proteine
        </button>
      </div>
    </section>

    <section>
      <h4>2. Base</h4>
      <div class="pill-row">
        {#each BASES as base}
          <button type="button" class:selected={baseId === base.id} on:click={() => (baseId = base.id)}>
            <img src="/ingredients/{base.image}" alt={base.label} class="ing-img" />
            {base.label}
            {#if liveSession.phase === 2}
              <span class="co2">{base.co2_g} gCO₂eq</span>
            {/if}
          </button>
        {/each}
      </div>
    </section>

    <section>
      <h4>3. Proteine</h4>
      <p class="tiny">Scegli 1 proteina per Regular, fino a 2 per Large.</p>
      <div class="pill-row">
        {#each PROTEINS as protein}
          <button
            type="button"
            class:selected={selectedProteins.includes(protein.id)}
            on:click={() => {
              const next = toggleSelection(selectedProteins, protein.id)
              if (size === 'regular' && next.length > 1) return
              if (size === 'large' && next.length > 2) return
              selectedProteins = next
            }}
          >
            <img src="/ingredients/{protein.image}" alt={protein.label} class="ing-img" />
            {protein.label}
            {#if liveSession.phase === 2}
              <span class="co2">{protein.co2_g} gCO₂eq</span>
            {/if}
          </button>
        {/each}
      </div>
    </section>

    <section>
      <h4>4. Ingredienti extra</h4>
      <p class="tiny">
        {size === 'regular' ? 'Scegli fino a 2 ingredienti extra.' : 'Scegli fino a 3 ingredienti extra.'}
      </p>
      <div class="pill-row">
        {#each EXTRAS as ing}
          <button
            type="button"
            class:selected={selectedExtras.includes(ing.id)}
            on:click={() => {
              const next = toggleSelection(selectedExtras, ing.id)
              const limit = size === 'regular' ? 2 : 3
              if (next.length > limit) return
              selectedExtras = next
            }}
          >
            <img src="/ingredients/{ing.image}" alt={ing.label} class="ing-img" />
            {ing.label}
            {#if liveSession.phase === 2}
              <span class="co2">{ing.co2_g} gCO₂eq</span>
            {/if}
          </button>
        {/each}
      </div>
    </section>

    <section class="footer">
      {#if liveSession.phase === 2}
        <p class="total">
          Totale stimato bowl corrente:
          <strong>{currentTotalCo2()} gCO₂eq</strong> ·
          <strong>{(currentTotalCo2() / DIESEL_CO2_PER_KM).toFixed(1)} km in auto diesel</strong>
        </p>
      {/if}

      <button class="primary" type="button" on:click={handleSaveBowl} disabled={isSaving}>
        {isSaving ? 'Salvataggio…' : 'Salva la bowl di questa fase'}
      </button>

      {#if errorMessage}
        <p class="error">{errorMessage}</p>
      {/if}
    </section>
  </div>

  <div class="summary">
    <h3>La tua esperienza</h3>
    {#if !summary}
      <p>Caricamento…</p>
    {:else}
      {#if summary.bowl1}
        <section>
          <h4>Bowl 1 – Scelta alla cieca</h4>
          <p class="meta">
            Impatto: <strong>{summary.bowl1.total_co2_g} gCO₂eq</strong> ·
            <strong>{summary.bowl1.total_km.toFixed(1)} km</strong> in auto diesel
          </p>
        </section>
      {/if}

      {#if summary.bowl2}
        <section>
          <h4>Bowl 2 – Scelta consapevole</h4>
          <p class="meta">
            Impatto: <strong>{summary.bowl2.total_co2_g} gCO₂eq</strong> ·
            <strong>{summary.bowl2.total_km.toFixed(1)} km</strong> in auto diesel
          </p>

          {#if summary.bowl1}
            <p class="meta">
              Differenza:
              <strong>{(function() { const diff = summary.bowl2.total_co2_g - summary.bowl1.total_co2_g; return diff > 0 ? '+' + diff : diff })()}gCO₂eq</strong> ·
              <strong>{(function() { const diff = (summary.bowl2.total_km - summary.bowl1.total_km).toFixed(1); return Number(diff) > 0 ? '+' + diff : diff })()} km</strong>
            </p>
          {/if}
        </section>
      {/if}

      {#if !summary.bowl1}
        <p class="hint">Quando salvi la bowl della Fase 1, la vedrai riassunta qui.</p>
      {:else if liveSession.phase === 2 && !summary.bowl2}
        <p class="hint">Ora puoi creare e salvare la bowl della Fase 2.</p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .bowl-layout {
    display: grid;
    grid-template-columns: 2fr 1.2fr;
    gap: 1.5rem;
    margin-top: 1rem;
  }

  @media (max-width: 900px) {
    .bowl-layout {
      grid-template-columns: 1fr;
    }
  }

  h3 {
    margin-top: 0;
    margin-bottom: 0.4rem;
  }

  h4 {
    margin-bottom: 0.3rem;
    margin-top: 0.8rem;
  }

  .hint {
    font-size: 0.92rem;
    color: #4b5563;
    margin-top: 0;
  }

  section {
    margin-top: 0.5rem;
  }

  .builder,
  .summary {
    border-radius: 1.25rem;
    border: 1px solid rgba(148, 163, 184, 0.6);
    padding: 1.25rem 1.5rem;
    background: #f9fafb;
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .pill-row button {
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.7);
    padding: 0.35rem 0.9rem;
    font-size: 0.9rem;
    background: white;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .pill-row button.selected {
    background: #22c55e;
    border-color: #16a34a;
    color: white;
  }

  .pill-row button .co2 {
    font-size: 0.8rem;
    opacity: 0.9;
  }

  .ing-img {
    width: 22px;
    height: 22px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .tiny {
    font-size: 0.8rem;
    color: #6b7280;
    margin-top: 0;
  }

  .footer {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .primary {
    align-self: flex-start;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    border: none;
    border-radius: 999px;
    padding: 0.65rem 1.4rem;
    font-weight: 600;
    cursor: pointer;
  }

  .primary:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .total {
    font-size: 0.92rem;
    color: #1f2937;
  }

  .error {
    color: #b91c1c;
    font-size: 0.9rem;
  }

  .summary .meta {
    font-size: 0.95rem;
    color: #374151;
  }
</style>
