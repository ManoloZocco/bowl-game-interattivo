<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import type { Bowl, Participant, Session } from './types'
  import { BASES, EXTRAS, PROTEINS, computeCo2, getIngredient } from './ingredients'
  import { fetchParticipantBowls, fetchSession, saveBowl } from './api'

  export let session: Session
  export let participant: Participant

  const dispatch = createEventDispatcher<{ exit: void }>()
  const DIESEL_CO2_PER_KM = 130

  let liveSession: Session = session
  let pollHandle: number | null = null

  // Selection state
  let size: Bowl['size'] = 'regular'
  let baseId = 'patate'
  let selectedProteins: string[] = ['ceci']
  let selectedExtras: string[] = ['pomodorini', 'noci']
  let dressingId = 'olio_evo'

  let isSaving = false
  let errorMessage = ''
  let summary: Awaited<ReturnType<typeof fetchParticipantBowls>> | null = null
  let copiedId = false
  let activeTab: 'componi' | 'impronta' | 'classifica' | 'guida' = 'componi'
  let breakdownCat: 'protein' | 'base' | 'extra' = 'protein'
  let showTipsModal = false

  // Default fallback values (matching Stitch Student #17 case study)
  const FALLBACK_B1 = {
    total_co2_g: 2626,
    total_km: 20.2,
    base_id: 'riso_bianco',
    protein_ids: ['salmone'],
    ingredient_ids: ['avocado', 'pomodorini']
  }

  const FALLBACK_B2 = {
    total_co2_g: 735,
    total_km: 5.6,
    base_id: 'patate',
    protein_ids: ['ceci'],
    ingredient_ids: ['pomodorini', 'noci']
  }

  async function refreshSession() {
    if (session.id === 'demo-session') return
    try {
      liveSession = await fetchSession(session.id)
      summary = await fetchParticipantBowls(session.id, participant.id)
      if (summary?.participantNumber && participant.number !== summary.participantNumber) {
        participant = { ...participant, number: summary.participantNumber }
      }
    } catch (error) {
      console.error(error)
    }
  }

  onMount(() => {
    refreshSession()
    pollHandle = window.setInterval(refreshSession, 4000)
  })

  onDestroy(() => {
    if (pollHandle) window.clearInterval(pollHandle)
  })

  function toggleProtein(id: string) {
    if (selectedProteins.includes(id)) {
      selectedProteins = selectedProteins.filter((x) => x !== id)
    } else {
      const maxProt = size === 'regular' ? 1 : 2
      if (selectedProteins.length >= maxProt) {
        if (maxProt === 1) {
          selectedProteins = [id]
        } else {
          selectedProteins = [selectedProteins[1], id]
        }
      } else {
        selectedProteins = [...selectedProteins, id]
      }
    }
  }

  function toggleExtra(id: string) {
    if (selectedExtras.includes(id)) {
      selectedExtras = selectedExtras.filter((x) => x !== id)
    } else {
      selectedExtras = [...selectedExtras, id]
    }
  }

  function currentTotalCo2(): number {
    const ids = [baseId, ...selectedProteins, ...selectedExtras]
    return computeCo2(ids)
  }

  function getCo2BadgeClass(co2: number): { bg: string; text: string; dot: string; label: string } {
    if (co2 < 200) {
      return { bg: 'bg-secondary-fixed', text: 'text-on-secondary-fixed-variant', dot: 'bg-secondary', label: `${co2}g CO₂` }
    } else if (co2 <= 600) {
      return { bg: 'bg-tertiary-fixed', text: 'text-on-tertiary-fixed-variant', dot: 'bg-tertiary', label: `${co2}g CO₂` }
    } else if (co2 <= 2500) {
      return { bg: 'bg-error-container', text: 'text-on-error-container', dot: 'bg-error', label: `${co2}g CO₂` }
    } else {
      return { bg: 'bg-error text-on-error', text: 'text-on-error', dot: 'bg-on-error', label: `⚠️ ${co2}g CO₂` }
    }
  }

  async function handleSaveCurrentPhase() {
    if (!baseId) {
      errorMessage = 'Seleziona una base per la tua bowl.'
      return
    }
    if (selectedProteins.length === 0) {
      errorMessage = 'Seleziona almeno una proteina.'
      return
    }

    try {
      errorMessage = ''
      isSaving = true
      const totalCo2 = currentTotalCo2()
      const totalKm = totalCo2 / DIESEL_CO2_PER_KM

      if (session.id !== 'demo-session') {
        await saveBowl({
          session_id: session.id,
          participant_id: participant.id,
          phase: liveSession.phase === 1 ? 1 : 2,
          size,
          base_id: baseId,
          protein_ids: selectedProteins,
          ingredient_ids: selectedExtras,
          total_co2_g: totalCo2,
          total_km: totalKm
        })
        await refreshSession()
      } else {
        // demo simulated save
        if (liveSession.phase === 1) {
          summary = {
            participantNumber: 17,
            bowl1: {
              id: 'demo-b1',
              session_id: session.id,
              participant_id: participant.id,
              phase: 1,
              size,
              base_id: baseId,
              protein_ids: selectedProteins,
              ingredient_ids: selectedExtras,
              total_co2_g: totalCo2,
              total_km: totalKm,
              created_at: new Date().toISOString()
            }
          }
        } else {
          summary = {
            ...(summary || { participantNumber: 17 }),
            participantNumber: 17,
            bowl2: {
              id: 'demo-b2',
              session_id: session.id,
              participant_id: participant.id,
              phase: 2,
              size,
              base_id: baseId,
              protein_ids: selectedProteins,
              ingredient_ids: selectedExtras,
              total_co2_g: totalCo2,
              total_km: totalKm,
              created_at: new Date().toISOString()
            }
          }
        }
      }
    } catch (err) {
      console.error(err)
      errorMessage = 'Errore durante il salvataggio della bowl. Riprova.'
    } finally {
      isSaving = false
    }
  }

  function copyParticipantId() {
    const num = participant.number ?? summary?.participantNumber ?? 17
    navigator.clipboard.writeText(String(num))
    copiedId = true
    setTimeout(() => (copiedId = false), 2500)
  }

  $: currentBase = getIngredient(baseId)
  $: currentProteinObjs = selectedProteins.map((id) => getIngredient(id)).filter(Boolean)
  $: currentExtraObjs = selectedExtras.map((id) => getIngredient(id)).filter(Boolean)

  // Deltas for Phase 2
  $: effectiveBowl1Total = summary?.bowl1?.total_co2_g ?? FALLBACK_B1.total_co2_g
  $: effectiveBowl1Km = summary?.bowl1?.total_km ?? FALLBACK_B1.total_km
  $: currentBowlCo2 = currentTotalCo2()
  $: deltaCo2 = effectiveBowl1Total - currentBowlCo2
  $: percentReduction = Math.round((deltaCo2 / effectiveBowl1Total) * 100)
  $: kmSaved = (deltaCo2 / DIESEL_CO2_PER_KM).toFixed(1).replace('.', ',')

  // Phase 3 Final values (with fallback to Stitch case study)
  $: b1Final = summary?.bowl1 ?? FALLBACK_B1
  $: b2Final = summary?.bowl2 ?? FALLBACK_B2
  $: finalCo2Saved = b1Final.total_co2_g - b2Final.total_co2_g
  $: finalReduction = Math.round((finalCo2Saved / b1Final.total_co2_g) * 100)
  $: finalKmSaved = (b1Final.total_km - b2Final.total_km).toFixed(1).replace('.', ',')
</script>

<div class="bg-surface font-body-md text-on-surface flex flex-col min-h-screen">
  <!-- Top App Header matching Stitch 01, 02, 03 -->
  <header class="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(27,77,62,0.04)] pt-safe">
    <div class="h-16 px-gutter flex items-center justify-between gap-space-sm max-w-lg mx-auto w-full">
      <div class="flex items-center gap-space-sm min-w-0">
        <div class="flex items-center gap-space-xs bg-surface-container-low px-space-sm py-1 rounded-full shadow-[0_1px_3px_rgba(27,77,62,0.04)]">
          <span class="material-symbols-outlined text-secondary text-[18px]">eco</span>
          <span class="font-label-sm text-label-sm text-primary uppercase font-bold truncate">UniSi Ecodynamics</span>
        </div>
        <div class="flex items-center gap-1 bg-secondary-container/60 px-space-sm py-1 rounded-full">
          <span class="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
          <span class="font-label-sm text-label-sm text-on-secondary-container tracking-wider font-bold">{session.code}</span>
        </div>
      </div>

      <div class="flex items-center gap-space-sm">
        <span class="px-space-sm py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-bold">
          ID #{participant.number ?? summary?.participantNumber ?? 17}
        </span>
        <button
          type="button"
          on:click={() => dispatch('exit')}
          aria-label="Esci dalla sessione"
          title="Esci"
          class="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors"
        >
          <span class="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </div>
  </header>

  <main class="flex flex-col relative w-full pt-16 pb-28 bg-surface min-h-screen max-w-md mx-auto px-margin">

    <!-- ========================================================================= -->
    <!-- FASE 1: SCELTA ALLA CIECA                                                -->
    <!-- ========================================================================= -->
    {#if liveSession.phase === 1}
      <div class="flex flex-col gap-space-md pt-space-md">
        
        <!-- Stepper Indicator matching Stitch 01 -->
        <div class="flex flex-col gap-space-xs bg-surface-container-low p-space-md rounded-xl shadow-sm">
          <div class="flex items-center justify-between">
            <span class="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-bold flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">visibility_off</span>
              Fase 1 di 3 · Blind Challenge
            </span>
            <span class="font-label-sm text-label-sm text-on-surface-variant font-semibold">Passo 1/3</span>
          </div>
          <div class="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden flex">
            <div class="h-full bg-secondary rounded-full transition-all duration-500 w-1/3"></div>
          </div>
          <div class="mt-space-xs">
            <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">Scelte alla cieca</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Crea la tua bowl preferita senza guardare i dati climatici. Scegli in piena libertà ciò che mangeresti davvero oggi!
            </p>
          </div>
        </div>

        <!-- Interactive Bowl Preview Canvas matching Stitch 01 -->
        <div class="relative bg-surface-container-lowest rounded-xl p-space-md shadow-md overflow-hidden flex flex-col items-center justify-center min-h-[220px]">
          <div class="absolute -top-12 -right-12 w-36 h-36 bg-secondary-container/30 rounded-full blur-2xl pointer-events-none"></div>
          <div class="absolute -bottom-8 -left-8 w-32 h-32 bg-surface-container-high/40 rounded-full blur-xl pointer-events-none"></div>

          <!-- Stylized Bowl with Floating Visual Food Layers -->
          <div class="relative w-48 h-36 flex flex-col items-center justify-end">
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <!-- Dressing drop -->
              <div class="absolute top-2 w-8 h-8 rounded-full bg-tertiary-fixed/80 flex items-center justify-center text-[16px] shadow-sm animate-bounce" style="animation-duration: 2.5s;">
                🫒
              </div>
              <!-- Protein layer -->
              <div class="absolute top-8 left-6 w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-[22px] shadow-sm transform -rotate-6 transition-all duration-300">
                {currentProteinObjs[0]?.icon ?? '🐟'}
              </div>
              <!-- Extra 1 -->
              <div class="absolute top-7 right-6 w-11 h-11 rounded-full bg-secondary-container flex items-center justify-center text-[20px] shadow-sm transform rotate-12 transition-all duration-300">
                {currentExtraObjs[0]?.icon ?? '🥑'}
              </div>
              <!-- Extra 2 -->
              <div class="absolute top-14 right-12 w-10 h-10 rounded-full bg-error-container flex items-center justify-center text-[18px] shadow-sm transform -rotate-12 transition-all duration-300">
                {currentExtraObjs[1]?.icon ?? '🍅'}
              </div>
              <!-- Base layer -->
              <div class="absolute bottom-6 w-28 h-10 rounded-full bg-surface-container-highest flex items-center justify-center shadow-inner text-[15px] text-on-surface-variant font-label-sm font-semibold">
                {currentBase?.icon ?? '🍚'} {currentBase?.label ?? 'Riso'}
              </div>
            </div>

            <!-- Ceramic Bowl Silhouette SVG -->
            <svg class="w-48 h-20 drop-shadow-md text-primary-container" fill="none" viewBox="0 0 200 90" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="100" cy="18" fill="#E2E7FF" fill-opacity="0.8" rx="90" ry="14"></ellipse>
              <path d="M10 18 C18 68, 62 86, 100 86 C138 86, 182 68, 190 18 Z" fill="currentColor"></path>
              <path d="M20 22 C30 60, 68 76, 100 76 C132 76, 170 60, 180 22 Z" fill="#245A4B" fill-opacity="0.6"></path>
              <ellipse cx="100" cy="85" fill="#002117" fill-opacity="0.2" rx="38" ry="4"></ellipse>
            </svg>
          </div>

          <!-- Recipe Mini Summary Chips -->
          <div class="mt-space-sm w-full flex items-center justify-center gap-1.5 flex-wrap">
            <span class="px-space-sm py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span>{currentBase?.label ?? 'Base'}</span>
            </span>
            {#each currentProteinObjs as prot}
              <span class="px-space-sm py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                <span>{prot.label}</span>
              </span>
            {/each}
            <span class="px-space-sm py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span>{selectedExtras.length} Extra</span>
            </span>
          </div>
        </div>

        <!-- 1. DIMENSIONE matching Stitch 01 -->
        <div class="flex flex-col gap-space-xs">
          <div class="flex items-center justify-between">
            <span class="font-label-lg text-label-lg text-primary uppercase font-bold tracking-wide">1. Scegli la dimensione</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Capacità proteine</span>
          </div>
          <div class="grid grid-cols-2 gap-space-sm">
            <button
              type="button"
              on:click={() => {
                size = 'regular'
                if (selectedProteins.length > 1) selectedProteins = [selectedProteins[0]]
              }}
              class="flex flex-col p-space-md rounded-xl text-left transition-all active:scale-[0.98] shadow-sm {size === 'regular' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface'}"
            >
              <div class="flex items-center justify-between w-full">
                <span class="font-title-md text-title-md font-bold">Regular</span>
                {#if size === 'regular'}
                  <span class="material-symbols-outlined text-[20px]">check_circle</span>
                {/if}
              </div>
              <span class="font-body-sm text-body-sm opacity-90 mt-1">1 Proteina inclusa</span>
              <span class="mt-2 text-[11px] font-label-sm bg-surface-container-lowest/60 px-2 py-0.5 rounded-full w-max">Classica &amp; equilibrata</span>
            </button>

            <button
              type="button"
              on:click={() => (size = 'large')}
              class="flex flex-col p-space-md rounded-xl text-left transition-all active:scale-[0.98] shadow-sm {size === 'large' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface'}"
            >
              <div class="flex items-center justify-between w-full">
                <span class="font-title-md text-title-md font-bold">Large</span>
                {#if size === 'large'}
                  <span class="material-symbols-outlined text-[20px]">check_circle</span>
                {/if}
              </div>
              <span class="font-body-sm text-body-sm opacity-90 mt-1">2 Proteine a scelta</span>
              <span class="mt-2 text-[11px] font-label-sm bg-surface-container px-2 py-0.5 rounded-full w-max text-on-surface-variant">Più ricca &amp; sostanziosa</span>
            </button>
          </div>
        </div>

        <!-- 2. BASE matching Stitch 01 -->
        <div class="flex flex-col gap-space-xs mt-space-xs">
          <div class="flex items-center justify-between">
            <span class="font-label-lg text-label-lg text-primary uppercase font-bold tracking-wide">2. Scegli la base</span>
            <span class="font-label-sm text-label-sm text-secondary font-semibold">1 selezionata</span>
          </div>
          <div class="flex flex-wrap gap-2">
            {#each BASES as base}
              <button
                type="button"
                on:click={() => (baseId = base.id)}
                class="px-space-md py-2.5 rounded-full font-label-lg text-label-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98] {baseId === base.id ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface'}"
              >
                <span>{base.icon ?? '🍚'}</span>
                <span>{base.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- 3. PROTEINE matching Stitch 01 -->
        <div class="flex flex-col gap-space-xs mt-space-xs">
          <div class="flex items-center justify-between">
            <span class="font-label-lg text-label-lg text-primary uppercase font-bold tracking-wide">3. Proteine</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">
              {size === 'regular' ? 'Scegli 1 ingrediente' : 'Scegli 2 ingredienti'}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-space-sm">
            {#each PROTEINS as prot}
              {@const isSelected = selectedProteins.includes(prot.id)}
              <button
                type="button"
                on:click={() => toggleProtein(prot.id)}
                class="p-space-sm rounded-xl text-left transition-all active:scale-[0.98] shadow-sm flex items-center gap-space-sm {isSelected ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface'}"
              >
                <span class="text-[28px] w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                  {prot.icon ?? '🍗'}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="font-label-lg text-label-lg font-bold truncate">{prot.label}</p>
                  <p class="font-label-sm text-label-sm opacity-80">{prot.portion ?? '80g'}</p>
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- 4. EXTRA matching Stitch 01 -->
        <div class="flex flex-col gap-space-xs mt-space-xs">
          <div class="flex items-center justify-between">
            <span class="font-label-lg text-label-lg text-primary uppercase font-bold tracking-wide">4. Ingredienti Extra</span>
            <span class="font-label-sm text-label-sm text-secondary font-semibold">{selectedExtras.length} selezionati</span>
          </div>
          <div class="grid grid-cols-2 gap-space-sm">
            {#each EXTRAS as ing}
              {@const isSelected = selectedExtras.includes(ing.id)}
              <button
                type="button"
                on:click={() => toggleExtra(ing.id)}
                class="p-space-sm rounded-xl text-left transition-all active:scale-[0.98] shadow-sm flex items-center justify-between {isSelected ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-lowest text-on-surface'}"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-[22px]">{ing.icon ?? '🥗'}</span>
                  <span class="font-label-md text-label-md font-medium truncate">{ing.label}</span>
                </div>
                {#if isSelected}
                  <span class="material-symbols-outlined text-[18px]">check</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Pedagogical Callout -->
        <div class="p-space-md rounded-xl bg-surface-container-low shadow-sm flex items-start gap-space-xs">
          <span class="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">psychology</span>
          <div class="flex flex-col">
            <span class="font-label-sm text-label-sm font-bold text-primary">Perché questa fase è alla cieca?</span>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Per misurare le nostre reali preferenze spontanee prima di confrontarci con i dati di emissione scientifici forniti dall'Ecodynamics Group di Siena.
            </p>
          </div>
        </div>

        <!-- Confirm Button Phase 1 -->
        <div class="mt-space-md pb-6">
          <button
            type="button"
            on:click={handleSaveCurrentPhase}
            disabled={isSaving}
            class="w-full h-14 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all hover:bg-primary-container active:scale-[0.99] disabled:opacity-60"
          >
            {#if isSaving}
              <span class="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
              <span>Salvataggio...</span>
            {:else}
              <span>Conferma la tua Bowl (Fase 1)</span>
              <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
            {/if}
          </button>
        </div>

      </div>

    <!-- ========================================================================= -->
    <!-- FASE 2: CLIMA & CONSAPEVOLEZZA                                           -->
    <!-- ========================================================================= -->
    {:else if liveSession.phase === 2}
      <div class="flex flex-col gap-space-md pt-space-md">
        
        <!-- Stepper Indicator matching Stitch 02 -->
        <div class="flex flex-col gap-space-xs">
          <div class="flex items-center justify-between">
            <span class="font-label-sm text-label-sm text-secondary uppercase font-bold tracking-wider">
              Fase 2 di 3 • Clima &amp; Consapevolezza
            </span>
            <span class="font-label-sm text-label-sm text-on-surface-variant font-semibold">66% completato</span>
          </div>
          <div class="flex items-center gap-1.5 w-full">
            <div class="h-2 flex-1 rounded-full bg-secondary-container"></div>
            <div class="h-2 flex-1 rounded-full bg-secondary"></div>
            <div class="h-2 flex-1 rounded-full bg-surface-container-highest"></div>
          </div>
        </div>

        <!-- Hero Impact Reveal Card matching Stitch 02 -->
        <div class="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-md mb-space-xs">
          <div class="flex items-center gap-space-xs mb-space-sm">
            <span class="px-space-sm py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm uppercase font-bold flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">bolt</span>
              Impatto Bowl 1 Rivelato
            </span>
            <span class="font-label-sm text-label-sm text-on-surface-variant">Sessione EcoDynamics</span>
          </div>

          <div class="flex flex-col gap-space-xs">
            <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">⚡ Ecco l'impatto della tua Bowl 1!</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant">
              Nella fase precedente hai composto la tua ricetta istintiva. Ora sveliamo le emissioni reali calcolate secondo il ciclo di vita (LCA).
            </p>
          </div>

          <!-- Impact Cards Split -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm mt-space-md">
            <div class="flex flex-col p-space-sm rounded-xl bg-error-container/40">
              <div class="flex items-center justify-between text-on-error-container mb-1">
                <span class="font-label-sm text-label-sm uppercase font-bold">Impronta Totale</span>
                <span class="material-symbols-outlined text-[18px]">cloud</span>
              </div>
              <div class="flex items-baseline gap-1">
                <span class="font-metric-display text-metric-display text-error font-extrabold leading-none">
                  {effectiveBowl1Total.toLocaleString('it-IT')}
                </span>
                <span class="font-label-md text-label-md text-on-surface-variant">gCO₂eq</span>
              </div>
              <span class="font-label-sm text-label-sm text-on-error-container mt-1 font-semibold">Budget pasto sostenibile: max 600g</span>
            </div>

            <div class="flex flex-col p-space-sm rounded-xl bg-surface-container">
              <div class="flex items-center justify-between text-on-surface mb-1">
                <span class="font-label-sm text-label-sm uppercase font-bold">Equivalente Stradale</span>
                <span class="material-symbols-outlined text-tertiary text-[18px]">directions_car</span>
              </div>
              <div class="flex items-baseline gap-1">
                <span class="font-headline-md text-headline-md text-tertiary font-extrabold leading-none">
                  {effectiveBowl1Km.toFixed(1).replace('.', ',')}
                </span>
                <span class="font-label-md text-label-md text-tertiary">km in auto diesel</span>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant mt-1">Calcolo UniSi: 1 km ≈ 130 gCO₂eq</span>
            </div>
          </div>
        </div>

        <!-- Mission Callout matching Stitch 02 -->
        <div class="flex items-start gap-space-sm p-space-md rounded-xl bg-secondary-container/50">
          <span class="material-symbols-outlined text-secondary text-[24px] shrink-0 mt-0.5">psychology_alt</span>
          <div class="flex flex-col">
            <h3 class="font-title-md text-title-md text-on-secondary-container font-bold">Sfida Consapevole: Riprogetta la Bowl</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Ora prova a ricreare una nuova bowl che ti piaccia, ma con il minimo impatto climatico possibile! Tutti gli ingredienti ora mostrano il costo in CO₂ in tempo reale.
            </p>
          </div>
        </div>

        <!-- 1. Basi con badge CO2 matching Stitch 02 -->
        <div class="flex flex-col gap-space-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-space-xs">
              <span class="w-6 h-6 rounded-full bg-primary-fixed flex items-center justify-center font-label-sm text-label-sm text-primary font-bold">1</span>
              <h4 class="font-title-md text-title-md text-on-surface font-semibold">Scegli la Base</h4>
            </div>
            <span class="font-label-sm text-label-sm text-secondary font-semibold uppercase">1 opzione</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
            {#each BASES as base}
              {@const isSelected = baseId === base.id}
              {@const badge = getCo2BadgeClass(base.co2_g)}
              <button
                type="button"
                on:click={() => (baseId = base.id)}
                class="relative flex items-center justify-between p-space-sm rounded-xl text-left transition-all shadow-sm active:scale-[0.98] {isSelected ? 'bg-secondary-container/40 ring-2 ring-secondary' : 'bg-surface-container-lowest'}"
              >
                <div class="flex items-center gap-space-sm min-w-0">
                  <span class="text-[26px]">{base.icon ?? '🍚'}</span>
                  <div class="flex flex-col min-w-0">
                    <span class="font-title-md text-title-md text-on-surface truncate font-semibold">{base.label}</span>
                    <span class="font-label-sm text-label-sm text-on-surface-variant">{base.portion ?? '150g'}</span>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="px-space-sm py-1 rounded-full {badge.bg} {badge.text} font-label-sm text-label-sm font-bold flex items-center gap-1 shrink-0">
                    <span class="w-1.5 h-1.5 rounded-full {badge.dot}"></span>
                    {badge.label}
                  </span>
                  {#if isSelected}
                    <span class="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- 2. Proteine con badge CO2 matching Stitch 02 -->
        <div class="flex flex-col gap-space-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-space-xs">
              <span class="w-6 h-6 rounded-full bg-primary-fixed flex items-center justify-center font-label-sm text-label-sm text-primary font-bold">2</span>
              <h4 class="font-title-md text-title-md text-on-surface font-semibold">Fonte Proteica</h4>
            </div>
            <span class="font-label-sm text-label-sm text-secondary font-semibold uppercase">1 opzione</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
            {#each PROTEINS as prot}
              {@const isSelected = selectedProteins.includes(prot.id)}
              {@const badge = getCo2BadgeClass(prot.co2_g)}
              <button
                type="button"
                on:click={() => toggleProtein(prot.id)}
                class="relative flex items-center justify-between p-space-sm rounded-xl text-left transition-all shadow-sm active:scale-[0.98] {isSelected ? 'bg-secondary-container/40 ring-2 ring-secondary' : 'bg-surface-container-lowest'}"
              >
                <div class="flex items-center gap-space-sm min-w-0">
                  <span class="text-[26px]">{prot.icon ?? '🍗'}</span>
                  <div class="flex flex-col min-w-0">
                    <span class="font-title-md text-title-md text-on-surface truncate font-semibold">{prot.label}</span>
                    <span class="font-label-sm text-label-sm text-on-surface-variant">{prot.portion ?? '80g'}</span>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="px-space-sm py-1 rounded-full {badge.bg} {badge.text} font-label-sm text-label-sm font-bold flex items-center gap-1 shrink-0">
                    <span class="w-1.5 h-1.5 rounded-full {badge.dot}"></span>
                    {badge.label}
                  </span>
                  {#if isSelected}
                    <span class="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- 3. Extra con badge CO2 matching Stitch 02 -->
        <div class="flex flex-col gap-space-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-space-xs">
              <span class="w-6 h-6 rounded-full bg-primary-fixed flex items-center justify-center font-label-sm text-label-sm text-primary font-bold">3</span>
              <h4 class="font-title-md text-title-md text-on-surface font-semibold">Extra &amp; Condimenti</h4>
            </div>
            <span class="font-label-sm text-label-sm text-secondary font-semibold uppercase">{selectedExtras.length} scelti</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
            {#each EXTRAS as ing}
              {@const isSelected = selectedExtras.includes(ing.id)}
              {@const badge = getCo2BadgeClass(ing.co2_g)}
              <button
                type="button"
                on:click={() => toggleExtra(ing.id)}
                class="relative flex items-center justify-between p-space-sm rounded-xl text-left transition-all shadow-sm active:scale-[0.98] {isSelected ? 'bg-secondary-container/40 ring-2 ring-secondary' : 'bg-surface-container-lowest'}"
              >
                <div class="flex items-center gap-space-sm min-w-0">
                  <span class="text-[26px]">{ing.icon ?? '🥗'}</span>
                  <div class="flex flex-col min-w-0">
                    <span class="font-title-md text-title-md text-on-surface truncate font-semibold">{ing.label}</span>
                    <span class="font-label-sm text-label-sm text-on-surface-variant">{ing.portion ?? '50g'}</span>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="px-space-sm py-1 rounded-full {badge.bg} {badge.text} font-label-sm text-label-sm font-bold flex items-center gap-1 shrink-0">
                    <span class="w-1.5 h-1.5 rounded-full {badge.dot}"></span>
                    {badge.label}
                  </span>
                  {#if isSelected}
                    <span class="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Science Mini-Card with photo matching Stitch 02 -->
        <div class="flex items-center gap-space-md p-space-md rounded-xl bg-surface-container-low shadow-sm">
          <img
            class="w-16 h-16 rounded-lg object-cover shrink-0"
            alt="Legumi e alimenti a basso impatto"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDEH7mEVCc3I7PbiDoKhNQ5sVfTmABiQjsT4zh5D56ZvbdtoZ_w5P3C_sIuZJr-CktcqkCBjPSlRKDVd_2DkllMlJvJOU8I48BARyZJdNJulF_WjMzGvqSvDNVy4RJOvgbHSG1gb7QIDbsBjQsMaeNXUqLBMfArR4iuUl3CckSaTTlWFqgfkqg_mt6qf9Xe1fX_zyUIXdSTiYjjzsXniJa_abUEe_7bL_qr29xd5JUjofbqy6wKhD2S9g"
          />
          <div class="flex flex-col min-w-0">
            <span class="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider">Perché i legumi?</span>
            <p class="font-body-sm text-body-sm text-on-surface-variant">
              I legumi fissano l'azoto nel suolo senza richiedere fertilizzanti sintetici chimici, riducendo le emissioni fino al 98% rispetto alle carni rosse.
            </p>
          </div>
        </div>

        <!-- Sticky Floating Delta Banner matching Stitch 02 (above bottom nav) -->
        <div class="fixed bottom-20 left-0 right-0 z-40 px-margin pointer-events-none">
          <div class="max-w-md mx-auto rounded-xl bg-primary text-on-primary p-space-md shadow-[0_16px_32px_-6px_rgba(0,54,41,0.35)] flex flex-col gap-space-xs transition-all pointer-events-auto">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-secondary-fixed text-[20px]">trending_down</span>
                <span class="font-label-sm text-label-sm text-secondary-fixed uppercase font-bold tracking-wider">Risparmio vs Bowl 1</span>
              </div>
              <span class="px-space-xs py-0.5 rounded bg-secondary text-on-secondary font-label-sm text-label-sm font-extrabold tracking-tight">
                {deltaCo2 >= 0 ? `-${percentReduction}% CO₂` : `+${Math.abs(percentReduction)}% CO₂`}
              </span>
            </div>

            <div class="flex items-baseline justify-between mt-0.5">
              <div>
                <span class="font-headline-lg-mobile text-headline-lg-mobile text-on-primary font-extrabold">
                  {deltaCo2 >= 0 ? `-${deltaCo2.toLocaleString('it-IT')}` : `+${Math.abs(deltaCo2).toLocaleString('it-IT')}`}
                </span>
                <span class="font-label-md text-label-md text-primary-fixed-dim">gCO₂eq</span>
              </div>
              <div class="flex items-center gap-1 text-right">
                <span class="material-symbols-outlined text-secondary-fixed text-[16px]">check</span>
                <span class="font-label-sm text-label-sm text-secondary-fixed font-bold">
                  {deltaCo2 >= 0 ? `${kmSaved} km in auto evitati!` : 'Impatto superiore a Bowl 1'}
                </span>
              </div>
            </div>

            <button
              type="button"
              on:click={handleSaveCurrentPhase}
              disabled={isSaving}
              class="w-full mt-space-xs py-2.5 px-space-md rounded-xl bg-secondary hover:bg-secondary-container hover:text-on-secondary-container text-on-secondary font-title-md text-title-md font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <span>Salva Bowl Consapevole (Fase 2)</span>
              <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>

      </div>

    <!-- ========================================================================= -->
    <!-- FASE 3: RISULTATI & IDENTITÀ ANONIMA                                     -->
    <!-- ========================================================================= -->
    {:else if liveSession.phase === 3}
      <div class="flex flex-col gap-space-md pt-space-md pb-6">
        
        <!-- Stepper Tracker matching Stitch 03 -->
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div class="flex items-center justify-between mb-space-xs">
            <span class="font-label-md text-label-md text-primary font-bold uppercase tracking-wider">Fase Finale • Impatto Personale</span>
            <span class="font-label-sm text-label-sm px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-bold">100% Completato</span>
          </div>
          <div class="w-full bg-surface-container-high h-2 rounded-full overflow-hidden flex">
            <div class="bg-secondary h-full w-full rounded-full transition-all duration-700"></div>
          </div>
          <div class="flex justify-between items-center mt-space-xs font-label-sm text-label-sm text-on-surface-variant">
            <span class="text-primary font-semibold">1. Scelta Istintiva</span>
            <span class="text-primary font-semibold">2. Scelta Consapevole</span>
            <span class="text-secondary font-bold">3. Risultati &amp; Identità</span>
          </div>
        </div>

        <!-- Celebration Card with Wave matching Stitch 03 -->
        <div class="relative overflow-hidden rounded-xl bg-primary text-on-primary p-space-lg shadow-md flex flex-col items-center text-center">
          <svg class="absolute inset-0 w-full h-full opacity-10 pointer-events-none" fill="none" preserveAspectRatio="none" viewBox="0 0 400 200">
            <path d="M0,100 C150,180 250,20 400,100 L400,200 L0,200 Z" fill="#6cf8bb"></path>
            <circle cx="350" cy="40" fill="#baeed9" r="60"></circle>
            <circle cx="40" cy="160" fill="#6cf8bb" r="40"></circle>
          </svg>

          <div class="relative z-10 w-20 h-20 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shadow-md mb-space-sm animate-bounce">
            <span class="material-symbols-outlined text-[42px]">emoji_events</span>
          </div>

          <div class="relative z-10 inline-flex items-center gap-space-xs bg-primary-container px-space-md py-1 rounded-full text-on-primary-container font-label-sm text-label-sm mb-space-xs">
            <span class="material-symbols-outlined text-[16px]">eco</span>
            Missione Climatica Raggiunta
          </div>

          <h1 class="relative z-10 font-headline-lg-mobile text-headline-lg-mobile font-bold tracking-tight text-on-primary leading-tight">
            Ottimo lavoro!<br/>Hai ridotto le emissioni del <span class="text-secondary-fixed">{finalReduction}%</span>!
          </h1>

          <p class="relative z-10 font-body-sm text-body-sm text-primary-fixed-dim mt-space-xs max-w-xs">
            Sostituendo proteine intensive e ingredienti ad alta impronta, la tua seconda composizione è un autentico modello rigenerativo.
          </p>
        </div>

        <!-- Anonymous Identity Card matching Stitch 03 -->
        <div class="bg-tertiary-fixed text-on-tertiary-fixed rounded-xl p-space-md shadow-sm relative overflow-hidden">
          <div class="flex items-start gap-space-md">
            <div class="w-14 h-14 rounded-xl bg-tertiary text-tertiary-fixed flex flex-col items-center justify-center flex-shrink-0 shadow-sm">
              <span class="font-label-sm text-label-sm uppercase font-bold tracking-wider opacity-80 leading-none">ID</span>
              <span class="font-headline-sm text-headline-sm font-extrabold leading-none mt-0.5">
                #{participant.number ?? summary?.participantNumber ?? 17}
              </span>
            </div>

            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-space-xs mb-0.5">
                <span class="font-title-md text-title-md font-bold text-on-tertiary-fixed">
                  Tu sei il Partecipante #{participant.number ?? summary?.participantNumber ?? 17}
                </span>
                <span class="material-symbols-outlined text-tertiary text-[18px]">verified_user</span>
              </div>
              <p class="font-body-sm text-body-sm text-on-tertiary-fixed-variant leading-snug">
                Tieni a mente questo numero quando il docente mostrerà il <strong>tabellone di classe</strong> sul proiettore per confrontare le tue scelte in totale anonimato.
              </p>
            </div>
          </div>

          <div class="mt-space-sm pt-space-xs flex items-center justify-between text-on-tertiary-fixed font-label-sm text-label-sm">
            <span class="inline-flex items-center gap-1 opacity-90">
              <span class="material-symbols-outlined text-[14px]">lock</span>
              Identità crittografata nella sessione
            </span>
            <button
              type="button"
              on:click={copyParticipantId}
              class="font-label-sm text-label-sm font-bold underline cursor-pointer hover:opacity-80"
            >
              {copiedId ? 'Copiato!' : 'Copia ID'}
            </button>
          </div>
        </div>

        <!-- Culinary Visual matching Stitch 03 -->
        <div class="w-full h-36 rounded-xl overflow-hidden relative shadow-sm">
          <img
            class="w-full h-full object-cover"
            alt="Confronto due bowl"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQShP05a6oqe-uSBIKdZC5DRu2b8_-HFNnxZVBRRKm5_OCZ3RORlkbTLYdJ0k47cHGSiTI1Ut1nXqAu-K6K_7_uyLlpyh-ES2CHnzKHfJDWkAonsN-058_JjAIo_XC8QAPhWzwc2TxfQbfR2tcMThptyPa9Xh7VY79Hf6gzRNCLzMKNCGuhb7eF8-eLZ0Lm_L40myksUGYv7a-z52zuS6Z4tajwH4cRCPooGnn49Li6H3w754Eq_WMpQ"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/30 to-transparent flex items-end p-space-md">
            <span class="text-on-primary font-title-md text-title-md font-bold flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[20px] text-secondary-fixed">restaurant</span>
              Il confronto delle due ricette
            </span>
          </div>
        </div>

        <!-- Scontrino Ecologico matching Stitch 03 -->
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div class="flex items-center justify-between mb-space-md">
            <span class="font-title-md text-title-md text-on-surface font-bold">Scontrino Ecologico</span>
            <span class="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">Analisi LCA</span>
          </div>

          <div class="grid grid-cols-2 gap-space-sm">
            <!-- Bowl 1 (Cieca) -->
            <div class="bg-error-container/40 rounded-xl p-space-sm flex flex-col justify-between">
              <div>
                <div class="flex items-center gap-1 text-error mb-1">
                  <span class="material-symbols-outlined text-[18px]">visibility_off</span>
                  <span class="font-label-md text-label-md font-bold truncate">Bowl 1 (Cieca)</span>
                </div>
                <div class="font-headline-sm text-headline-sm font-extrabold text-on-error-container">
                  {b1Final.total_co2_g.toLocaleString('it-IT')} <span class="font-label-sm text-label-sm font-normal">g CO₂e</span>
                </div>
                <div class="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                  <span class="material-symbols-outlined text-[14px]">directions_car</span>
                  {b1Final.total_km.toFixed(1).replace('.', ',')} km auto
                </div>

                <ul class="mt-space-sm space-y-1 font-label-sm text-label-sm text-on-surface-variant">
                  <li class="flex items-center gap-1 truncate">
                    <span class="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0"></span>
                    <span>{getIngredient(b1Final.base_id)?.label ?? 'Riso bianco'}</span>
                  </li>
                  {#each b1Final.protein_ids as pId}
                    <li class="flex items-center gap-1 truncate">
                      <span class="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0"></span>
                      <span class="font-bold text-on-surface">{getIngredient(pId)?.label ?? 'Salmone norv.'}</span>
                    </li>
                  {/each}
                  {#each b1Final.ingredient_ids as iId}
                    <li class="flex items-center gap-1 truncate">
                      <span class="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0"></span>
                      <span>{getIngredient(iId)?.label ?? iId}</span>
                    </li>
                  {/each}
                </ul>
              </div>
              <div class="mt-space-md pt-space-xs text-center font-label-sm text-label-sm text-error font-medium">
                Impronta Elevata
              </div>
            </div>

            <!-- Bowl 2 (Clima) -->
            <div class="bg-secondary-container/30 rounded-xl p-space-sm flex flex-col justify-between">
              <div>
                <div class="flex items-center gap-1 text-secondary mb-1">
                  <span class="material-symbols-outlined text-[18px]">eco</span>
                  <span class="font-label-md text-label-md font-bold truncate">Bowl 2 (Clima)</span>
                </div>
                <div class="font-headline-sm text-headline-sm font-extrabold text-secondary">
                  {b2Final.total_co2_g.toLocaleString('it-IT')} <span class="font-label-sm text-label-sm font-normal">g CO₂e</span>
                </div>
                <div class="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                  <span class="material-symbols-outlined text-[14px]">directions_car</span>
                  {b2Final.total_km.toFixed(1).replace('.', ',')} km auto
                </div>

                <ul class="mt-space-sm space-y-1 font-label-sm text-label-sm text-on-surface-variant">
                  <li class="flex items-center gap-1 truncate">
                    <span class="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0"></span>
                    <span>{getIngredient(b2Final.base_id)?.label ?? 'Patate dolci'}</span>
                  </li>
                  {#each b2Final.protein_ids as pId}
                    <li class="flex items-center gap-1 truncate">
                      <span class="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0"></span>
                      <span class="font-bold text-on-surface">{getIngredient(pId)?.label ?? 'Ceci bio loc.'}</span>
                    </li>
                  {/each}
                  {#each b2Final.ingredient_ids as iId}
                    <li class="flex items-center gap-1 truncate">
                      <span class="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0"></span>
                      <span>{getIngredient(iId)?.label ?? iId}</span>
                    </li>
                  {/each}
                </ul>
              </div>
              <div class="mt-space-md pt-space-xs text-center font-label-sm text-label-sm text-secondary font-bold">
                Budget Planetario Riscalato
              </div>
            </div>
          </div>

          <!-- Net Highlight Box matching Stitch 03 -->
          <div class="mt-space-md rounded-xl bg-secondary text-on-secondary p-space-md shadow-sm flex items-center justify-between">
            <div class="flex items-center gap-space-sm">
              <span class="material-symbols-outlined text-[28px]">trending_down</span>
              <div>
                <span class="font-headline-sm text-headline-sm font-extrabold">-{finalCo2Saved.toLocaleString('it-IT')} g CO₂eq</span>
                <p class="font-label-sm text-label-sm opacity-90">Pari a {finalKmSaved} km in auto diesel non percorsi</p>
              </div>
            </div>
            <div class="px-space-md py-space-xs rounded-xl bg-secondary-container text-on-secondary-container font-headline-sm text-headline-sm font-extrabold">
              -{finalReduction}%
            </div>
          </div>
        </div>

        <!-- Interactive Category Breakdown Visualizer matching Stitch 03 -->
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div class="flex items-center justify-between mb-space-xs">
            <div class="flex flex-col">
              <span class="font-title-md text-title-md text-on-surface font-bold">Distribuzione per Categoria</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant">Tocca una categoria per confrontare i due scenari</span>
            </div>
            <span class="material-symbols-outlined text-secondary text-[24px]">donut_large</span>
          </div>

          <!-- Category Filter Tabs -->
          <div class="flex gap-space-xs mt-space-sm mb-space-md">
            <button
              type="button"
              on:click={() => breakdownCat = 'protein'}
              class="flex-1 py-1.5 px-2 rounded-xl font-label-sm text-label-sm font-bold text-center transition-all {breakdownCat === 'protein' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}"
            >
              🥩 Proteine
            </button>
            <button
              type="button"
              on:click={() => breakdownCat = 'base'}
              class="flex-1 py-1.5 px-2 rounded-xl font-label-sm text-label-sm font-bold text-center transition-all {breakdownCat === 'base' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}"
            >
              🍚 Basi
            </button>
            <button
              type="button"
              on:click={() => breakdownCat = 'extra'}
              class="flex-1 py-1.5 px-2 rounded-xl font-label-sm text-label-sm font-bold text-center transition-all {breakdownCat === 'extra' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}"
            >
              🥑 Extra/Topping
            </button>
          </div>

          <!-- Comparative Bar Visual -->
          <div class="space-y-space-sm">
            {#if breakdownCat === 'protein'}
              <div>
                <div class="flex justify-between items-center font-label-sm text-label-sm mb-1">
                  <span class="font-bold text-error">Bowl 1 (Salmone 120g)</span>
                  <span class="font-bold text-on-surface">1.820 g CO₂e (69%)</span>
                </div>
                <div class="h-3.5 bg-surface-container-high rounded-full overflow-hidden flex">
                  <div class="h-full bg-error rounded-full transition-all duration-500" style="width: 82%;"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between items-center font-label-sm text-label-sm mb-1">
                  <span class="font-bold text-secondary">Bowl 2 (Ceci bio 120g)</span>
                  <span class="font-bold text-on-surface">210 g CO₂e (28%)</span>
                </div>
                <div class="h-3.5 bg-surface-container-high rounded-full overflow-hidden flex">
                  <div class="h-full bg-secondary rounded-full transition-all duration-500" style="width: 14%;"></div>
                </div>
              </div>
              <div class="bg-surface-container rounded-xl p-space-sm text-on-surface font-body-sm text-body-sm mt-space-sm flex items-start gap-space-xs">
                <span class="material-symbols-outlined text-secondary text-[20px] shrink-0">lightbulb</span>
                <span class="text-on-surface-variant">
                  <strong>Fattore Chiave:</strong> Le proteine animali (soprattutto pesce da allevamento intensivo e carni rosse) pesano fino al 70-80% dell'impatto totale a causa della catena alimentare e logistica refrigerata.
                </span>
              </div>
            {:else if breakdownCat === 'base'}
              <div>
                <div class="flex justify-between items-center font-label-sm text-label-sm mb-1">
                  <span class="font-bold text-error">Bowl 1 (Riso Bianco 150g)</span>
                  <span class="font-bold text-on-surface">510 g CO₂e (19%)</span>
                </div>
                <div class="h-3.5 bg-surface-container-high rounded-full overflow-hidden flex">
                  <div class="h-full bg-error rounded-full transition-all duration-500" style="width: 40%;"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between items-center font-label-sm text-label-sm mb-1">
                  <span class="font-bold text-secondary">Bowl 2 (Patate dolci 150g)</span>
                  <span class="font-bold text-on-surface">180 g CO₂e (24%)</span>
                </div>
                <div class="h-3.5 bg-surface-container-high rounded-full overflow-hidden flex">
                  <div class="h-full bg-secondary rounded-full transition-all duration-500" style="width: 16%;"></div>
                </div>
              </div>
              <div class="bg-surface-container rounded-xl p-space-sm text-on-surface font-body-sm text-body-sm mt-space-sm flex items-start gap-space-xs">
                <span class="material-symbols-outlined text-secondary text-[20px] shrink-0">lightbulb</span>
                <span class="text-on-surface-variant">
                  <strong>Fattore Chiave:</strong> Le risaie allagate generano emissioni anaerobiche di gas metano (CH₄). Sostituire con tuberi o cereali asciutti abbatte l'impronta di oltre il 60%.
                </span>
              </div>
            {:else}
              <div>
                <div class="flex justify-between items-center font-label-sm text-label-sm mb-1">
                  <span class="font-bold text-error">Bowl 1 (Avocado + Serra 100g)</span>
                  <span class="font-bold text-on-surface">296 g CO₂e (12%)</span>
                </div>
                <div class="h-3.5 bg-surface-container-high rounded-full overflow-hidden flex">
                  <div class="h-full bg-error rounded-full transition-all duration-500" style="width: 26%;"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between items-center font-label-sm text-label-sm mb-1">
                  <span class="font-bold text-secondary">Bowl 2 (Carote + Noci 100g)</span>
                  <span class="font-bold text-on-surface">345 g CO₂e (48%)</span>
                </div>
                <div class="h-3.5 bg-surface-container-high rounded-full overflow-hidden flex">
                  <div class="h-full bg-secondary rounded-full transition-all duration-500" style="width: 29%;"></div>
                </div>
              </div>
              <div class="bg-surface-container rounded-xl p-space-sm text-on-surface font-body-sm text-body-sm mt-space-sm flex items-start gap-space-xs">
                <span class="material-symbols-outlined text-secondary text-[20px] shrink-0">lightbulb</span>
                <span class="text-on-surface-variant">
                  <strong>Fattore Chiave:</strong> La frutta a guscio locale ha un'impronta leggermente maggiore per densità calorica, ma garantisce fotosintesi arborea e zero trasporto aereo!
                </span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Discussion Card matching Stitch 03 -->
        <div class="p-space-md rounded-xl bg-surface-container-low shadow-sm flex items-start gap-space-sm">
          <div class="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[20px]">forum</span>
          </div>
          <div class="flex flex-col">
            <span class="font-label-sm text-label-sm font-bold text-secondary uppercase tracking-wider">Domanda di Gruppo</span>
            <p class="font-title-md text-title-md text-primary font-bold mt-0.5">
              Cosa ti ha sorpreso di più? Il peso della proteina o l'origine degli alimenti?
            </p>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Preparati ad argomentare la tua scelta con il resto della classe quando apparirà la graduatoria collettiva sulla LIM.
            </p>
          </div>
        </div>

        <!-- Secondary Photo Card: Sustainable Food Prep matching Stitch 03 -->
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center gap-space-md">
          <img
            class="w-20 h-20 rounded-xl object-cover shrink-0 shadow-sm"
            alt="Dieta Mediterranea e Pianeta"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCWvnKUx9GFN5Tlhr_XP1JokDKMbvceCaePhf93kz9wujuczLtDZoLImmW8EnIem_rm7QOCRCKffUDfcCs7JrlRH91V5e9gaRiYU96hJbd2DhGY2w7iKLDoy453XMyDzRjD4xsN6N6u1ZxMrkX5Dm1FhotqeZbtTJG9ByXEaLi3p0GsPG0uMdHoxrnguN3RHbVE9CukyuHNANRSJmPqXzWa7GP0ErZbRHZtoCBLzJ1etoZmBfbkkAqopA"
          />
          <div class="flex flex-col min-w-0">
            <span class="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider">Cultura Cibo</span>
            <span class="font-title-md text-title-md text-on-surface font-bold truncate">Dieta Mediterranea &amp; Pianeta</span>
            <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-0.5">
              I legumi locali non solo riducono la CO₂, ma rigenerano l'azoto nei suoli agricoli.
            </p>
          </div>
        </div>

        <!-- Action Buttons Section matching Stitch 03 -->
        <div class="flex flex-col gap-space-sm pb-12">
          <button
            type="button"
            on:click={() => showTipsModal = true}
            class="w-full bg-primary-container text-on-primary py-space-sm px-space-md rounded-xl font-label-lg text-label-lg font-bold flex items-center justify-center gap-space-xs shadow-sm active:scale-[0.98] transition-transform"
          >
            <span class="material-symbols-outlined text-[20px] text-secondary-fixed">psychology_alt</span>
            <span>Vedi suggerimenti e consigli sostenibili 🌿</span>
          </button>

          <div class="w-full bg-surface-container-high text-on-surface py-space-sm px-space-md rounded-xl font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs shadow-sm">
            <div class="w-2.5 h-2.5 rounded-full bg-secondary animate-ping mr-1"></div>
            <span>In attesa che il docente apra la discussione...</span>
          </div>
        </div>

      </div>
    {/if}

    <!-- Tips Modal matching Stitch 03 -->
    {#if showTipsModal}
      <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
        <div class="bg-surface-container-lowest rounded-2xl p-space-lg w-full max-w-lg shadow-2xl relative max-h-[85vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-space-sm mb-space-sm border-b border-surface-container">
            <div class="flex items-center gap-space-xs">
              <span class="material-symbols-outlined text-secondary text-[24px]">energy_savings_leaf</span>
              <span class="font-headline-sm text-headline-sm font-bold text-primary">Consigli Pratici Quotidiani</span>
            </div>
            <button
              type="button"
              on:click={() => showTipsModal = false}
              class="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div class="space-y-space-md">
            <div class="flex gap-space-sm items-start">
              <div class="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold shrink-0">1</div>
              <div>
                <div class="font-title-md text-title-md font-bold text-on-surface">La Regola del 70/30</div>
                <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Componi il tuo piatto con il 70% di vegetali, cereali integrali e legumi. Lascia alle proteine animali un ruolo da contorno speciale.</p>
              </div>
            </div>
            <div class="flex gap-space-sm items-start">
              <div class="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold shrink-0">2</div>
              <div>
                <div class="font-title-md text-title-md font-bold text-on-surface">Fai Attenzione alla Serra Calda</div>
                <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">I pomodorini e le verdure fuori stagione coltivate in serre riscaldate a gasolio possono emettere più CO₂ di alcuni tagli di carne bianca locale.</p>
              </div>
            </div>
            <div class="flex gap-space-sm items-start">
              <div class="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold shrink-0">3</div>
              <div>
                <div class="font-title-md text-title-md font-bold text-on-surface">Varietà dei Cereali</div>
                <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Alterna il riso bianco (che emette metano nelle risaie allagate) con orzo, farro, patate e grano saraceno a basso consumo idrico.</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            on:click={() => showTipsModal = false}
            class="mt-space-lg w-full bg-primary text-on-primary py-space-sm rounded-xl font-label-lg text-label-lg font-bold hover:bg-primary-container transition-colors"
          >
            Ho Capito, Torna ai Risultati
          </button>
        </div>
      </div>
    {/if}

  </main>

  <!-- Fixed Bottom Navigation Bar matching Stitch 01, 02, 03 -->
  <nav class="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-4px_16px_rgba(27,77,62,0.06)]">
    <div class="flex justify-around items-center h-16 px-space-sm max-w-md mx-auto">
      <button
        type="button"
        on:click={() => (activeTab = 'componi')}
        class="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors {activeTab === 'componi' ? 'text-secondary font-semibold' : 'text-on-surface-variant hover:text-on-surface'}"
      >
        <span class="material-symbols-outlined text-[24px]">skillet</span>
        <span class="font-label-sm text-label-sm mt-0.5">Componi</span>
      </button>

      <button
        type="button"
        on:click={() => (activeTab = 'impronta')}
        class="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors {activeTab === 'impronta' ? 'text-secondary font-semibold' : 'text-on-surface-variant hover:text-on-surface'}"
      >
        <span class="material-symbols-outlined text-[24px]">speed</span>
        <span class="font-label-sm text-label-sm mt-0.5">Impronta</span>
      </button>

      <button
        type="button"
        on:click={() => (activeTab = 'classifica')}
        class="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors {activeTab === 'classifica' ? 'text-secondary font-semibold' : 'text-on-surface-variant hover:text-on-surface'}"
      >
        <span class="material-symbols-outlined text-[24px]">leaderboard</span>
        <span class="font-label-sm text-label-sm mt-0.5">Classifica</span>
      </button>

      <button
        type="button"
        on:click={() => (activeTab = 'guida')}
        class="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] transition-colors {activeTab === 'guida' ? 'text-secondary font-semibold' : 'text-on-surface-variant hover:text-on-surface'}"
      >
        <span class="material-symbols-outlined text-[24px]">menu_book</span>
        <span class="font-label-sm text-label-sm mt-0.5">Guida</span>
      </button>
    </div>
  </nav>
</div>
