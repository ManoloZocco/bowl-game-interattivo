<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import {
    createSession,
    countParticipants,
    fetchClassSummary,
    finalizeSessionAndAssignNumbers,
    updateSessionPhase,
    fetchSession
  } from './api'
  import type { ClassSummaryRow, Session } from './api'
  import { getIngredient } from './ingredients'

  const dispatch = createEventDispatcher<{ exit: void }>()
  const DIESEL_CO2_PER_KM = 130

  let session: Session | null = null
  let isLoading = false
  let errorMessage = ''
  let participantCount = 0
  let summary: ClassSummaryRow[] = []
  let isFinalized = false
  let pollHandle: number | null = null

  // UI state
  let showQrModal = false
  let selectedStudentIndex = 0
  let sortBy: 'delta' | 'number' = 'delta'

  async function handleCreateSession() {
    try {
      isLoading = true
      errorMessage = ''
      session = await createSession()
      participantCount = 0
      summary = []
      isFinalized = false
    } catch (error) {
      errorMessage = 'Errore nella creazione della sessione.'
      console.error(error)
    } finally {
      isLoading = false
    }
  }

  async function refreshData() {
    if (!session) return
    try {
      const [latestSession, pCount, classSummary] = await Promise.all([
        fetchSession(session.id),
        countParticipants(session.id),
        fetchClassSummary(session.id)
      ])

      session = latestSession
      participantCount = pCount
      summary = classSummary
      if (session.phase === 3) {
        isFinalized = true
      }
    } catch (error) {
      console.error(error)
    }
  }

  onMount(() => {
    // If a session was already active or we can check
    pollHandle = window.setInterval(refreshData, 4000)
  })

  onDestroy(() => {
    if (pollHandle) window.clearInterval(pollHandle)
  })

  async function setPhase(phase: 1 | 2) {
    if (!session) return
    try {
      isLoading = true
      await updateSessionPhase(session.id, phase)
      session = { ...session, phase }
      await refreshData()
    } catch (error) {
      console.error(error)
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
      isFinalized = true
      await refreshData()
    } catch (error) {
      console.error(error)
      errorMessage = 'Errore durante la conclusione della sessione.'
    } finally {
      isLoading = false
    }
  }

  // Derived metrics for Teacher Dashboard
  $: studentsWithBothBowls = summary.filter((s) => s.bowl1 && s.bowl2)
  $: studentsWithBowl1 = summary.filter((s) => s.bowl1)

  $: totalCo2Bowl1 = studentsWithBothBowls.reduce((acc, s) => acc + (s.bowl1?.total_co2_g ?? 0), 0)
  $: totalCo2Bowl2 = studentsWithBothBowls.reduce((acc, s) => acc + (s.bowl2?.total_co2_g ?? 0), 0)
  $: totalCo2Saved = Math.max(0, totalCo2Bowl1 - totalCo2Bowl2)
  $: totalKgSaved = (totalCo2Saved / 1000).toFixed(1)
  $: totalKmSaved = (totalCo2Saved / DIESEL_CO2_PER_KM).toFixed(1)

  $: avgBowl1Co2 =
    studentsWithBothBowls.length > 0
      ? Math.round(totalCo2Bowl1 / studentsWithBothBowls.length)
      : studentsWithBowl1.length > 0
      ? Math.round(studentsWithBowl1.reduce((acc, s) => acc + (s.bowl1?.total_co2_g ?? 0), 0) / studentsWithBowl1.length)
      : 0

  $: avgBowl2Co2 =
    studentsWithBothBowls.length > 0 ? Math.round(totalCo2Bowl2 / studentsWithBothBowls.length) : 0

  $: avgPercentReduction =
    avgBowl1Co2 > 0 && avgBowl2Co2 > 0 ? Math.round(((avgBowl1Co2 - avgBowl2Co2) / avgBowl1Co2) * 100) : 0

  $: improvedCount = studentsWithBothBowls.filter(
    (s) => (s.bowl1?.total_co2_g ?? 0) > (s.bowl2?.total_co2_g ?? 0)
  ).length

  $: percentImproved =
    studentsWithBothBowls.length > 0
      ? Math.round((improvedCount / studentsWithBothBowls.length) * 100)
      : 0

  // Protein shift calculation (meat/salmon in bowl 1 replaced by plant-based in bowl 2)
  $: proteinShiftCount = studentsWithBothBowls.filter((s) => {
    const b1Heavy = s.bowl1?.protein_ids.some((id) => ['manzo', 'salmone', 'gamberi', 'suino'].includes(id))
    const b2Green = s.bowl2?.protein_ids.some((id) => ['ceci', 'tofu', 'uova'].includes(id))
    return b1Heavy && b2Green
  }).length

  $: proteinShiftPercentage =
    studentsWithBothBowls.length > 0
      ? Math.round((proteinShiftCount / studentsWithBothBowls.length) * 100)
      : 0

  // Sorted student list
  $: sortedStudents = [...summary].sort((a, b) => {
    if (sortBy === 'delta') {
      const deltaA = (a.bowl1?.total_co2_g ?? 0) - (a.bowl2?.total_co2_g ?? 0)
      const deltaB = (b.bowl1?.total_co2_g ?? 0) - (b.bowl2?.total_co2_g ?? 0)
      return deltaB - deltaA
    }
    return (a.participantNumber ?? 999) - (b.participantNumber ?? 999)
  })

  $: selectedStudent = sortedStudents[selectedStudentIndex] ?? sortedStudents[0] ?? null

  $: joinUrl =
    typeof window !== 'undefined' && session
      ? `${window.location.origin}/bowl/?code=${session.code}`
      : ''
</script>

<div class="bg-background font-body-md text-on-surface min-h-screen flex flex-col">
  <!-- Top Navigation Bar -->
  <header class="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(27,77,62,0.06)]">
    <div class="h-20 w-full px-margin md:px-margin-desktop flex items-center justify-between gap-gutter">
      <div class="flex items-center gap-space-md">
        <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-secondary-fixed shadow-[0_2px_8px_-2px_rgba(27,77,62,0.12)]">
          <span class="material-symbols-outlined text-[24px]">nest_eco_leaf</span>
        </div>
        <div class="flex flex-col">
          <span class="font-headline-sm text-headline-sm text-primary tracking-tight">Crea la tua Bowl • LIM</span>
          <span class="font-label-sm text-label-sm text-on-surface-variant font-medium tracking-wide">
            UniSi Ecodynamics Group • Monitor Proiettore 16:9
          </span>
        </div>
      </div>

      <div class="flex items-center gap-space-md">
        <button
          type="button"
          on:click={() => dispatch('exit')}
          class="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors font-label-md text-label-md"
        >
          <span class="material-symbols-outlined text-[20px]">arrow_back</span>
          <span>Esci alla Home</span>
        </button>
      </div>
    </div>
  </header>

  <main class="w-full pt-20 pb-16 bg-background flex-1">
    {#if !session}
      <!-- State: No Active Session -->
      <div class="max-w-xl mx-auto my-16 p-space-xl bg-surface-container-lowest rounded-2xl shadow-xl text-center flex flex-col items-center gap-space-md">
        <div class="w-16 h-16 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
          <span class="material-symbols-outlined text-[36px]">cast_for_education</span>
        </div>
        <h2 class="font-display-lg-mobile text-display-lg-mobile text-primary font-bold">Avvia Nuova Sessione LIM</h2>
        <p class="font-body-md text-body-md text-on-surface-variant max-w-md">
          Genera un codice univoco per la tua classe. Gli studenti potranno collegarsi dai loro smartphone inquadrando il QR code o inserendo il codice.
        </p>
        <button
          type="button"
          on:click={handleCreateSession}
          disabled={isLoading}
          class="px-space-xl py-4 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center gap-space-sm shadow-lg hover:bg-primary-container transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {#if isLoading}
            <span class="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
            <span>Creazione sessione...</span>
          {:else}
            <span class="material-symbols-outlined text-[24px] text-secondary-fixed">add_circle</span>
            <span>Crea Nuova Sessione di Classe</span>
          {/if}
        </button>
        {#if errorMessage}
          <p class="text-error font-label-md text-label-md">{errorMessage}</p>
        {/if}
      </div>

    {:else}
      <!-- State: Active Session Dashboard -->

      <!-- Monitor Banner Bar -->
      <section class="w-full bg-surface-container-low px-margin md:px-margin-desktop py-space-md shadow-sm">
        <div class="w-full flex flex-col xl:flex-row items-center justify-between gap-space-md max-w-7xl mx-auto">
          
          <div class="flex items-center gap-space-md w-full xl:w-auto justify-between xl:justify-start">
            <div class="flex flex-col">
              <div class="flex items-center gap-space-xs">
                <span class="font-headline-sm text-headline-sm text-primary tracking-tight">Ecodynamics Classroom Monitor</span>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
                  <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  SESSIONE ATTIVA
                </span>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Crea la tua Bowl • LIM Projector Engine 16:9
              </span>
            </div>
          </div>

          <!-- PIN and QR Toggle -->
          <div class="flex items-center gap-space-sm bg-surface-container-lowest p-space-xs rounded-2xl shadow-sm">
            <div class="flex items-center px-space-md py-space-xs bg-primary text-on-primary rounded-xl">
              <span class="font-label-sm text-label-sm tracking-widest text-primary-fixed mr-2 uppercase font-bold">PIN CLASSE:</span>
              <span class="font-headline-md text-headline-md tracking-widest font-extrabold text-secondary-fixed select-all">
                {session.code}
              </span>
            </div>
            <button
              type="button"
              on:click={() => (showQrModal = true)}
              class="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg transition-colors shadow-sm"
            >
              <span class="material-symbols-outlined text-[20px] text-primary">qr_code_scanner</span>
              <span class="hidden sm:inline font-semibold">Mostra QR Schermo Intero</span>
            </button>
          </div>

          <!-- Connected Students & Phase Stepper Tracker -->
          <div class="flex items-center gap-space-md flex-wrap justify-center xl:justify-end">
            <div class="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container-lowest text-on-surface shadow-sm">
              <span class="relative flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
              </span>
              <span class="font-headline-sm text-headline-sm text-primary font-bold">{participantCount}</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Studenti Collegati</span>
            </div>

            <!-- Stepper Badges -->
            <div class="flex items-center bg-surface-container-lowest p-1 rounded-xl shadow-sm">
              <div class="flex items-center gap-1 px-3 py-1.5 rounded-lg font-label-sm text-label-sm {session.phase === 1 ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant opacity-75'}">
                {#if session.phase > 1}
                  <span class="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                {/if}
                <span>1. Cieca</span>
              </div>
              <div class="flex items-center gap-1 px-3 py-1.5 rounded-lg font-label-sm text-label-sm {session.phase === 2 ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant opacity-75'}">
                {#if session.phase > 2}
                  <span class="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                {/if}
                <span>2. Consapevole</span>
              </div>
              <div class="flex items-center gap-1 px-3 py-1.5 rounded-lg font-label-sm text-label-sm {session.phase === 3 ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant opacity-75'}">
                {#if session.phase === 3}
                  <span class="material-symbols-outlined text-[16px] text-secondary-fixed">auto_graph</span>
                {/if}
                <span>3. Risultati Classe</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      <!-- Stepper Controls Bar for Teacher -->
      <section class="w-full bg-surface-container px-margin md:px-margin-desktop py-space-sm border-b border-outline-variant/30">
        <div class="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-space-sm">
          <div class="flex items-center gap-space-xs text-on-surface-variant font-label-md text-label-md">
            <span class="material-symbols-outlined text-[18px] text-primary">play_circle</span>
            <span>
              Stato corrente:
              <strong class="text-primary">
                {session.phase === 1 ? 'Fase 1 – Gli studenti compongono la prima bowl alla cieca' : session.phase === 2 ? 'Fase 2 – Svelamento LCA e sfida di riduzione' : 'Fase 3 – Sessione conclusa, tabellone anonimo attivo'}
              </strong>
            </span>
          </div>

          <div class="flex items-center gap-space-sm">
            {#if session.phase === 1}
              <button
                type="button"
                on:click={() => setPhase(2)}
                disabled={isLoading}
                class="px-space-md py-2 rounded-xl bg-secondary text-on-secondary font-label-lg text-label-lg font-bold flex items-center gap-space-xs shadow-sm hover:bg-secondary-container hover:text-on-secondary-container transition-all"
              >
                <span>Passa alla Fase 2 (Consapevolezza LCA)</span>
                <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            {:else if session.phase === 2}
              <button
                type="button"
                on:click={handleFinalize}
                disabled={isLoading || isFinalized}
                class="px-space-md py-2 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-bold flex items-center gap-space-xs shadow-sm hover:bg-primary-container transition-all"
              >
                <span>Concludi Sessione &amp; Assegna ID Anonimi</span>
                <span class="material-symbols-outlined text-[18px] text-secondary-fixed">workspace_premium</span>
              </button>
            {/if}

            <button
              type="button"
              on:click={refreshData}
              title="Aggiorna dati"
              class="p-2 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors shadow-sm"
            >
              <span class="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Dashboard Body Content (KPIs, Charts, Spotlight, Student Wall) -->
      <div class="w-full px-margin md:px-margin-desktop py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto">
        
        <!-- 4 KPI Metric Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          
          <!-- KPI 1: CO2 Risparmiata Totale -->
          <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden">
            <div class="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-secondary-fixed/20 pointer-events-none blur-xl"></div>
            <div class="flex items-start justify-between">
              <span class="font-label-sm text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">CO₂ Risparmiata Totale</span>
              <span class="p-2 rounded-xl bg-secondary-container text-on-secondary-container">
                <span class="material-symbols-outlined text-[24px]">eco</span>
              </span>
            </div>
            <div class="my-space-sm">
              <div class="font-metric-display text-metric-display text-secondary tracking-tight">
                -{totalKgSaved} <span class="text-headline-md font-body-md text-on-surface-variant font-semibold">kg CO₂e</span>
              </div>
            </div>
            <div class="flex items-center gap-1 text-secondary font-label-md text-label-md">
              <span class="material-symbols-outlined text-[18px]">trending_down</span>
              <span class="font-bold">-{avgPercentReduction}%</span>
              <span class="text-on-surface-variant font-normal">rispetto alla prima prova</span>
            </div>
          </div>

          <!-- KPI 2: Chilometri Auto Evitati -->
          <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden">
            <div class="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-primary-fixed/20 pointer-events-none blur-xl"></div>
            <div class="flex items-start justify-between">
              <span class="font-label-sm text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">Chilometri Auto Evitati</span>
              <span class="p-2 rounded-xl bg-surface-container-high text-primary">
                <span class="material-symbols-outlined text-[24px]">directions_car</span>
              </span>
            </div>
            <div class="my-space-sm">
              <div class="font-metric-display text-metric-display text-primary tracking-tight">
                {totalKmSaved} <span class="text-headline-md font-body-md text-on-surface-variant font-semibold">km</span>
              </div>
            </div>
            <div class="flex items-center gap-1 text-on-surface-variant font-label-md text-label-md">
              <span class="material-symbols-outlined text-[16px] text-primary">alt_route</span>
              <span>130 gCO₂eq ≈ 1 km in auto</span>
            </div>
          </div>

          <!-- KPI 3: Miglioramento di Gruppo -->
          <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden">
            <div class="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-secondary-container/30 pointer-events-none blur-xl"></div>
            <div class="flex items-start justify-between">
              <span class="font-label-sm text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">Miglioramento di Gruppo</span>
              <span class="p-2 rounded-xl bg-secondary-fixed text-on-secondary-fixed">
                <span class="material-symbols-outlined text-[24px]">workspace_premium</span>
              </span>
            </div>
            <div class="my-space-sm">
              <div class="font-metric-display text-metric-display text-on-surface tracking-tight">
                {percentImproved}% <span class="text-headline-md font-body-md text-secondary font-bold">In Target</span>
              </div>
            </div>
            <div class="flex items-center gap-1 text-on-surface-variant font-label-md text-label-md">
              <span class="material-symbols-outlined text-[16px] text-secondary">verified</span>
              <span class="font-semibold text-primary">{improvedCount} su {studentsWithBothBowls.length}</span>
              <span>hanno ridotto l'impatto</span>
            </div>
          </div>

          <!-- KPI 4: Proteina Rivoluzionata -->
          <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden">
            <div class="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-tertiary-fixed/30 pointer-events-none blur-xl"></div>
            <div class="flex items-start justify-between">
              <span class="font-label-sm text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">Proteina Rivoluzionata</span>
              <span class="p-2 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed">
                <span class="material-symbols-outlined text-[24px]">psychology_alt</span>
              </span>
            </div>
            <div class="my-space-sm">
              <div class="font-metric-display text-metric-display text-tertiary tracking-tight">
                {proteinShiftPercentage}% <span class="text-headline-md font-body-md text-on-surface-variant font-semibold">Shift</span>
              </div>
            </div>
            <div class="flex items-center gap-1 text-on-surface-variant font-label-md text-label-md">
              <span class="material-symbols-outlined text-[16px] text-tertiary">swap_horiz</span>
              <span>Sostituiti manzo/salmone con legumi</span>
            </div>
          </div>

        </div>

        <!-- Comparative Chart & Student Spotlight Card (12 Columns Grid) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
          
          <!-- Left Column (7 cols): Collective Comparative Analysis -->
          <div class="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-space-lg shadow-md flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between flex-wrap gap-2 mb-space-md">
                <div>
                  <span class="font-label-sm text-label-sm font-bold text-on-surface-variant tracking-wider uppercase">Analisi Comparativa Collettiva</span>
                  <h2 class="font-headline-md text-headline-md text-primary">Impatto Ambientale Medio per Bowl (g CO₂eq)</h2>
                </div>
                <div class="flex items-center gap-space-sm bg-surface-container-low px-space-sm py-1 rounded-lg">
                  <span class="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                    <span class="w-3 h-3 rounded-full bg-error"></span> Fase Cieca
                  </span>
                  <span class="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                    <span class="w-3 h-3 rounded-full bg-secondary"></span> Fase Consapevole
                  </span>
                </div>
              </div>

              <!-- Bar Comparisons -->
              <div class="w-full mt-space-md flex flex-col gap-space-lg">
                <!-- Bar 1: Media Bowl 1 -->
                <div class="flex flex-col gap-space-xs">
                  <div class="flex justify-between items-baseline">
                    <span class="font-title-md text-title-md text-on-surface font-semibold flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-error"></span>
                      Media Bowl 1: Scelta Cieca (Iniziale)
                    </span>
                    <span class="font-headline-sm text-headline-sm font-extrabold text-error">
                      {avgBowl1Co2.toLocaleString('it-IT')} g CO₂e
                    </span>
                  </div>
                  <div class="w-full bg-surface-container h-9 rounded-xl overflow-hidden p-1 flex items-center shadow-inner">
                    <div
                      class="bg-error/90 h-full rounded-lg transition-all duration-1000 flex items-center justify-end pr-3 text-on-error font-label-sm text-label-sm font-bold"
                      style="width: {avgBowl1Co2 > 0 ? Math.min(100, Math.max(15, Math.round((avgBowl1Co2 / 3000) * 100))) : 0}%;"
                    >
                      {#if avgBowl1Co2 > 600}
                        +{Math.round(((avgBowl1Co2 - 600) / 600) * 100)}% sopra target EAT-Lancet
                      {/if}
                    </div>
                  </div>
                  <span class="font-label-sm text-label-sm text-on-surface-variant">
                    Elevato impatto derivato da carni rosse, pesce intensivo e ingredienti aerei.
                  </span>
                </div>

                <!-- Bar 2: Media Bowl 2 -->
                <div class="flex flex-col gap-space-xs">
                  <div class="flex justify-between items-baseline">
                    <span class="font-title-md text-title-md text-on-surface font-semibold flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                      Media Bowl 2: Scelta Consapevole (LCA Guidata)
                    </span>
                    <span class="font-headline-sm text-headline-sm font-extrabold text-secondary">
                      {avgBowl2Co2.toLocaleString('it-IT')} g CO₂e
                    </span>
                  </div>
                  <div class="w-full bg-surface-container h-9 rounded-xl overflow-hidden p-1 flex items-center shadow-inner">
                    <div
                      class="bg-secondary h-full rounded-lg transition-all duration-1000 flex items-center justify-end pr-3 text-on-secondary font-label-sm text-label-sm font-bold"
                      style="width: {avgBowl2Co2 > 0 ? Math.min(100, Math.max(15, Math.round((avgBowl2Co2 / 3000) * 100))) : 0}%;"
                    >
                      {#if avgPercentReduction > 0}
                        Riduzione -{avgPercentReduction}%
                      {/if}
                    </div>
                  </div>
                  <span class="font-label-sm text-label-sm text-on-surface-variant">
                    Predilezione per legumi toscani, cereali rustici e verdure di stagione a km zero.
                  </span>
                </div>

                <!-- Target EAT-Lancet Line -->
                <div class="relative pt-2">
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-label-md text-label-md font-bold text-primary flex items-center gap-1">
                      <span class="material-symbols-outlined text-[18px]">verified</span>
                      Target Sostenibile Planetario (EAT-Lancet Commission)
                    </span>
                    <span class="font-label-md text-label-md font-bold text-primary">≤ 600 g CO₂e</span>
                  </div>
                  <div class="w-full bg-surface-container-high h-2 rounded-full relative overflow-hidden">
                    <div class="absolute left-0 top-0 bottom-0 bg-primary-fixed-dim" style="width: 20%;"></div>
                  </div>
                  <p class="mt-2 font-body-sm text-body-sm text-on-surface-variant italic">
                    La soglia raccomandata per preservare gli equilibri biogeochimici terrestri e la salute umana.
                  </p>
                </div>
              </div>
            </div>

            <div class="mt-space-lg pt-space-md bg-surface-container-low p-space-md rounded-2xl flex items-center justify-between">
              <div class="flex items-center gap-space-sm">
                <span class="material-symbols-outlined text-[28px] text-primary">insights</span>
                <div class="flex flex-col">
                  <span class="font-title-md text-title-md font-bold text-primary">Differenziale Netto della Classe</span>
                  <span class="font-body-sm text-body-sm text-on-surface-variant">
                    Risparmio medio: {avgBowl1Co2 > avgBowl2Co2 ? (avgBowl1Co2 - avgBowl2Co2).toLocaleString('it-IT') : 0} g CO₂e per porzione
                  </span>
                </div>
              </div>
              <div class="px-space-md py-space-xs rounded-xl bg-secondary text-on-secondary font-headline-sm text-headline-sm font-extrabold">
                -{avgPercentReduction}%
              </div>
            </div>
          </div>

          <!-- Right Column (5 cols): Spotlight Student Discussion Card -->
          <div class="lg:col-span-5 bg-primary text-on-primary rounded-2xl p-space-lg shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div class="absolute top-0 right-0 w-64 h-64 bg-secondary-fixed/10 rounded-full blur-3xl pointer-events-none"></div>

            {#if selectedStudent}
              {@const b1 = selectedStudent.bowl1}
              {@const b2 = selectedStudent.bowl2}
              {@const studentDelta = b1 && b2 ? b1.total_co2_g - b2.total_co2_g : 0}
              {@const studentReduction = b1 && b2 && b1.total_co2_g > 0 ? Math.round((studentDelta / b1.total_co2_g) * 100) : 0}

              <div>
                <div class="flex items-center justify-between mb-space-sm">
                  <span class="px-space-sm py-1 rounded-full bg-primary-container text-secondary-fixed font-label-sm text-label-sm font-bold uppercase tracking-wider">
                    Focus Discussione in Aula
                  </span>
                  <span class="font-label-sm text-label-sm text-primary-fixed-dim">
                    ID: #{selectedStudent.participantNumber ?? '–'}
                  </span>
                </div>

                <h3 class="font-headline-md text-headline-md text-surface tracking-tight mb-space-md">
                  Studente Anonimo #{selectedStudent.participantNumber ?? '–'}: Confronto Ricette
                </h3>

                <!-- Side by Side Boxes for Selected Student -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm mb-space-md">
                  
                  <!-- Bowl 1 Box -->
                  <div class="bg-primary-container p-space-sm rounded-xl">
                    <div class="flex items-center justify-between pb-2 mb-2 bg-surface/5 p-1 rounded-lg">
                      <span class="font-label-sm text-label-sm font-bold text-tertiary-fixed">1. CIÈCA</span>
                      <span class="font-title-md text-title-md font-extrabold text-error-container">
                        {b1 ? `${b1.total_co2_g}g` : '–'}
                      </span>
                    </div>
                    {#if b1}
                      <ul class="flex flex-col gap-1.5 font-label-md text-label-md text-inverse-on-surface">
                        <li class="flex justify-between items-center">
                          <span class="truncate">{getIngredient(b1.base_id)?.label ?? 'Base'}</span>
                          <span class="font-semibold text-primary-fixed-dim">{getIngredient(b1.base_id)?.co2_g ?? 0}g</span>
                        </li>
                        {#each b1.protein_ids as pId}
                          {@const pObj = getIngredient(pId)}
                          <li class="flex justify-between items-center bg-error/20 px-1 rounded">
                            <span class="font-bold text-error-container truncate">{pObj?.label ?? pId}</span>
                            <span class="font-bold text-error-container">{pObj?.co2_g ?? 0}g</span>
                          </li>
                        {/each}
                        {#each b1.ingredient_ids.slice(0, 2) as iId}
                          {@const iObj = getIngredient(iId)}
                          <li class="flex justify-between items-center">
                            <span class="truncate">{iObj?.label ?? iId}</span>
                            <span class="font-semibold text-primary-fixed-dim">{iObj?.co2_g ?? 0}g</span>
                          </li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="font-label-sm text-label-sm text-primary-fixed-dim italic">Non ancora inviata</p>
                    {/if}
                  </div>

                  <!-- Bowl 2 Box -->
                  <div class="bg-primary-container p-space-sm rounded-xl">
                    <div class="flex items-center justify-between pb-2 mb-2 bg-secondary-container/20 p-1 rounded-lg">
                      <span class="font-label-sm text-label-sm font-bold text-secondary-fixed">2. CONSAPEVOLE</span>
                      <span class="font-title-md text-title-md font-extrabold text-secondary-fixed">
                        {b2 ? `${b2.total_co2_g}g` : '–'}
                      </span>
                    </div>
                    {#if b2}
                      <ul class="flex flex-col gap-1.5 font-label-md text-label-md text-inverse-on-surface">
                        <li class="flex justify-between items-center">
                          <span class="truncate">{getIngredient(b2.base_id)?.label ?? 'Base'}</span>
                          <span class="font-semibold text-secondary-fixed-dim">{getIngredient(b2.base_id)?.co2_g ?? 0}g</span>
                        </li>
                        {#each b2.protein_ids as pId}
                          {@const pObj = getIngredient(pId)}
                          <li class="flex justify-between items-center bg-secondary/30 px-1 rounded">
                            <span class="font-bold text-secondary-fixed truncate">{pObj?.label ?? pId}</span>
                            <span class="font-bold text-secondary-fixed">{pObj?.co2_g ?? 0}g</span>
                          </li>
                        {/each}
                        {#each b2.ingredient_ids.slice(0, 2) as iId}
                          {@const iObj = getIngredient(iId)}
                          <li class="flex justify-between items-center">
                            <span class="truncate">{iObj?.label ?? iId}</span>
                            <span class="font-semibold text-secondary-fixed-dim">{iObj?.co2_g ?? 0}g</span>
                          </li>
                        {/each}
                      </ul>
                    {:else}
                      <p class="font-label-sm text-label-sm text-primary-fixed-dim italic">In attesa di Bowl 2</p>
                    {/if}
                  </div>
                </div>

                <!-- Discussion prompt -->
                <div class="p-space-sm rounded-xl bg-surface/10 backdrop-blur-md">
                  <div class="flex items-start gap-space-xs">
                    <span class="material-symbols-outlined text-secondary-fixed text-[24px]">forum</span>
                    <div class="flex flex-col">
                      <span class="font-label-sm text-label-sm font-bold text-secondary-fixed uppercase tracking-wider">
                        Guida Docente per il Dibattito
                      </span>
                      <p class="font-body-md text-body-md text-surface-bright mt-1 leading-snug">
                        “Quale sostituzione ha contribuito maggiormente alla riduzione delle emissioni in questo piatto? Come influisce il fattore di conversione del foraggio per le proteine animali rispetto all'efficienza dei legumi?”
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-space-md pt-space-xs flex items-center justify-between">
                <span class="font-label-sm text-label-sm text-primary-fixed-dim">
                  Delta Individuale: -{studentReduction}%
                </span>
                <span class="px-space-md py-space-xs rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md font-bold shadow-sm">
                  Partecipante #{selectedStudent.participantNumber ?? '–'}
                </span>
              </div>
            {:else}
              <div class="flex flex-col items-center justify-center py-12 text-center text-primary-fixed-dim">
                <span class="material-symbols-outlined text-[48px] mb-2 opacity-60">person_search</span>
                <p>Nessun partecipante collegato o selezionato.</p>
              </div>
            {/if}

          </div>
        </div>

        <!-- Anonymous Student Wall Grid (Mappa Anonima dei Partecipanti) -->
        <div class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-md">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-md">
            <div>
              <div class="flex items-center gap-space-xs">
                <span class="font-headline-md text-headline-md text-primary font-bold">Mappa Anonima dei Partecipanti</span>
                <span class="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
                  {studentsWithBothBowls.length} / {summary.length} Completati
                </span>
              </div>
              <span class="font-body-sm text-body-sm text-on-surface-variant">
                Clicca su una scheda studente per esaminare la sua ricetta nel pannello di discussione in alto.
              </span>
            </div>

            <div class="flex items-center gap-space-xs">
              <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Ordina per:</span>
              <button
                type="button"
                on:click={() => (sortBy = 'delta')}
                class="px-space-sm py-1 rounded-lg font-label-sm text-label-sm font-bold transition-colors {sortBy === 'delta' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}"
              >
                Maggiore Riduzione
              </button>
              <button
                type="button"
                on:click={() => (sortBy = 'number')}
                class="px-space-sm py-1 rounded-lg font-label-sm text-label-sm font-bold transition-colors {sortBy === 'number' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}"
              >
                Numero ID
              </button>
            </div>
          </div>

          {#if summary.length === 0}
            <div class="py-12 text-center text-on-surface-variant flex flex-col items-center gap-2">
              <span class="material-symbols-outlined text-[40px] text-primary">groups</span>
              <p class="font-body-md text-body-md">In attesa che gli studenti si colleghino con il PIN <strong>{session.code}</strong>...</p>
            </div>
          {:else}
            <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-space-sm">
              {#each sortedStudents as student, idx}
                {@const b1 = student.bowl1}
                {@const b2 = student.bowl2}
                {@const delta = b1 && b2 ? b1.total_co2_g - b2.total_co2_g : 0}
                {@const reduction = b1 && b2 && b1.total_co2_g > 0 ? Math.round((delta / b1.total_co2_g) * 100) : 0}
                {@const isSelected = selectedStudent?.participantId === student.participantId}

                <button
                  type="button"
                  on:click={() => (selectedStudentIndex = idx)}
                  class="cursor-pointer p-space-sm rounded-xl text-left transition-all hover:-translate-y-0.5 shadow-sm flex flex-col justify-between {isSelected ? 'bg-secondary-container text-on-secondary-container ring-2 ring-secondary' : 'bg-surface-container-low hover:bg-surface-container text-on-surface'}"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="font-label-sm text-label-sm font-bold">#{student.participantNumber ?? idx + 1}</span>
                    {#if b1 && b2}
                      <span class="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-secondary text-on-secondary font-extrabold">
                        -{reduction}%
                      </span>
                    {:else if b1}
                      <span class="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                        Fase 1
                      </span>
                    {:else}
                      <span class="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                        Attesa
                      </span>
                    {/if}
                  </div>

                  <div class="my-1.5 flex flex-col font-label-sm text-label-sm">
                    <span class="text-error font-medium">{b1 ? `${b1.total_co2_g}g` : '–'}</span>
                    <span class="text-secondary font-bold text-title-md">{b2 ? `${b2.total_co2_g}g` : '–'}</span>
                  </div>

                  <span class="font-label-sm text-label-sm opacity-80 truncate w-full">
                    {#if b2}
                      {b2.protein_ids.map((id) => getIngredient(id)?.label).join(', ')}
                    {:else if b1}
                      {b1.protein_ids.map((id) => getIngredient(id)?.label).join(', ')}
                    {:else}
                      In attesa
                    {/if}
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- LIM Bottom Control Bar -->
        <div class="w-full bg-surface-container-low rounded-2xl p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-md shadow-sm">
          <div class="flex items-center gap-space-sm">
            <div class="w-12 h-12 rounded-xl bg-primary text-secondary-fixed flex items-center justify-center">
              <span class="material-symbols-outlined text-[28px]">cast</span>
            </div>
            <div class="flex flex-col">
              <span class="font-headline-sm text-headline-sm text-primary font-bold">Modalità Presentazione LIM Attiva</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">
                Risoluzione ottimizzata 1920x1080 (16:9) ad alto contrasto per visione da fondo aula.
              </span>
            </div>
          </div>

          <div class="flex items-center gap-space-sm">
            <button
              type="button"
              on:click={() => window.print()}
              class="px-space-md py-space-sm rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <span class="material-symbols-outlined text-[20px]">print</span>
              <span>Stampa Report Classe</span>
            </button>
            <button
              type="button"
              on:click={handleCreateSession}
              class="px-space-md py-space-sm rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <span class="material-symbols-outlined text-[20px] text-secondary-fixed">replay</span>
              <span>Nuova Sessione</span>
            </button>
          </div>
        </div>

      </div>

      <!-- High-Contrast Fullscreen QR Modal -->
      {#if showQrModal}
        <div class="fixed inset-0 z-50 bg-on-surface/80 backdrop-blur-md flex items-center justify-center p-space-md">
          <div class="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-space-lg shadow-2xl flex flex-col items-center text-center relative">
            <button
              type="button"
              on:click={() => (showQrModal = false)}
              class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-2 rounded-xl bg-surface-container"
            >
              <span class="material-symbols-outlined text-[24px]">close</span>
            </button>

            <span class="font-label-sm text-label-sm font-bold text-secondary uppercase tracking-widest mb-1">
              Scansiona con Smartphone
            </span>
            <h3 class="font-headline-lg text-headline-lg text-primary mb-2 font-bold">Entra nella Sfida della Bowl</h3>
            <p class="font-body-md text-body-md text-on-surface-variant mb-space-md max-w-md">
              Inquadra il codice QR con la fotocamera per partecipare istantaneamente alla sessione di classe
            </p>

            <div class="p-space-md bg-surface-container-low rounded-2xl shadow-inner flex items-center justify-center mb-space-md">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&data={encodeURIComponent(joinUrl)}&bgcolor=faf8ff&color=003629"
                alt="QR Code Sessione {session.code}"
                class="w-64 h-64 rounded-xl shadow-md"
              />
            </div>

            <div class="flex flex-col items-center">
              <span class="font-label-sm text-label-sm text-on-surface-variant">Oppure vai sul link e digita il PIN:</span>
              <div class="mt-2 px-space-md py-space-xs rounded-xl bg-primary text-secondary-fixed font-metric-display text-metric-display tracking-widest font-extrabold shadow-md">
                {session.code}
              </div>
            </div>
          </div>
        </div>
      {/if}

    {/if}
  </main>
</div>
