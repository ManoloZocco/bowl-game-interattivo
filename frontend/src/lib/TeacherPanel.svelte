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

  export let initialSession: Session | null = null

  let session: Session = initialSession ?? {
    id: 'demo-session',
    code: 'NMLHM',
    phase: 3,
    created_at: new Date().toISOString()
  }

  let isLoading = false
  let errorMessage = ''
  let participantCount = initialSession && initialSession.id !== 'demo-session' ? 0 : 28
  let summary: ClassSummaryRow[] = []
  let isFinalized = initialSession && initialSession.id !== 'demo-session' ? false : true
  let pollHandle: number | null = null

  // UI state
  let showQrModal = false
  let selectedStudentIndex = 0
  let sortBy: 'delta' | 'number' = 'delta'
  let useDemoData = !initialSession || initialSession.id === 'demo-session'

  // 28 Sample students from Stitch design
  const DEMO_STUDENTS = [
    { number: 1, b1: 2890, b2: 820, delta: '-71%', text: 'Ceci, Farro', base1: 'riso_bianco', p1: 'salmone', base2: 'patate', p2: 'ceci' },
    { number: 2, b1: 2410, b2: 690, delta: '-71%', text: 'Tofu, Broccoli', base1: 'riso_bianco', p1: 'pollo', base2: 'riso_integrale', p2: 'tofu' },
    { number: 3, b1: 3100, b2: 740, delta: '-76%', text: 'Lenticchie, Orzo', base1: 'noodles', p1: 'manzo', base2: 'riso_integrale', p2: 'ceci' },
    { number: 4, b1: 1450, b2: 650, delta: '-55%', text: 'Uova bio, Riso', base1: 'riso_bianco', p1: 'uova', base2: 'patate', p2: 'uova' },
    { number: 5, b1: 2780, b2: 610, delta: '-78%', text: 'Fagioli, Zucchine', base1: 'riso_bianco', p1: 'manzo', base2: 'patate', p2: 'tofu' },
    { number: 6, b1: 2250, b2: 710, delta: '-68%', text: 'Piselli, Patate', base1: 'riso_bianco', p1: 'pollo', base2: 'patate', p2: 'ceci' },
    { number: 7, b1: 1980, b2: 620, delta: '-69%', text: 'Ceci, Pomodori', base1: 'riso_integrale', p1: 'feta', base2: 'riso_integrale', p2: 'ceci' },
    { number: 8, b1: 3120, b2: 790, delta: '-74%', text: 'Hummus, Carote', base1: 'riso_bianco', p1: 'salmone', base2: 'noodles', p2: 'ceci' },
    { number: 9, b1: 2050, b2: 680, delta: '-67%', text: 'Edamame, Farro', base1: 'riso_bianco', p1: 'gamberi', base2: 'patate', p2: 'tofu' },
    { number: 10, b1: 2650, b2: 710, delta: '-73%', text: 'Lupini, Spinaci', base1: 'noodles', p1: 'suino', base2: 'riso_integrale', p2: 'ceci' },
    { number: 11, b1: 2400, b2: 780, delta: '-68%', text: 'Lenticchie rosse', base1: 'riso_bianco', p1: 'salmone', base2: 'patate', p2: 'ceci' },
    { number: 12, b1: 2280, b2: 590, delta: '-74%', text: 'Target EAT Superato', base1: 'riso_bianco', p1: 'pollo', base2: 'patate', p2: 'ceci' },
    { number: 13, b1: 2850, b2: 810, delta: '-72%', text: 'Ceci, Finocchi', base1: 'noodles', p1: 'salmone', base2: 'patate', p2: 'ceci' },
    { number: 14, b1: 1890, b2: 640, delta: '-66%', text: 'Quinoa, Noci', base1: 'riso_bianco', p1: 'feta', base2: 'riso_integrale', p2: 'tofu' },
    { number: 15, b1: 2710, b2: 705, delta: '-74%', text: 'Farro, Zucchine', base1: 'riso_bianco', p1: 'salmone', base2: 'patate', p2: 'ceci' },
    { number: 16, b1: 3240, b2: 850, delta: '-74%', text: 'Ceci, Grano', base1: 'noodles', p1: 'manzo', base2: 'patate', p2: 'ceci' },
    { number: 17, b1: 2626, b2: 735, delta: '-72%', text: 'Salmone -> Ceci', base1: 'riso_bianco', p1: 'salmone', base2: 'patate', p2: 'ceci' },
    { number: 18, b1: 2510, b2: 720, delta: '-71%', text: 'Fagioli, Zucca', base1: 'riso_bianco', p1: 'pollo', base2: 'riso_integrale', p2: 'ceci' },
    { number: 19, b1: 2150, b2: 680, delta: '-68%', text: 'Lenticchie bio', base1: 'noodles', p1: 'feta', base2: 'patate', p2: 'tofu' },
    { number: 20, b1: 2340, b2: 690, delta: '-70%', text: 'Piselli, Patate', base1: 'riso_bianco', p1: 'suino', base2: 'patate', p2: 'ceci' },
    { number: 21, b1: 2850, b2: 740, delta: '-74%', text: 'Ceci, Riso', base1: 'riso_bianco', p1: 'salmone', base2: 'riso_integrale', p2: 'ceci' },
    { number: 22, b1: 1920, b2: 610, delta: '-68%', text: 'Hummus, Zucchine', base1: 'noodles', p1: 'uova', base2: 'patate', p2: 'tofu' },
    { number: 23, b1: 1950, b2: 810, delta: '-58%', text: 'Ricotta locale', base1: 'riso_bianco', p1: 'pollo', base2: 'riso_integrale', p2: 'uova' },
    { number: 24, b1: 3300, b2: 790, delta: '-76%', text: 'Ceci, Pomodori', base1: 'noodles', p1: 'manzo', base2: 'patate', p2: 'ceci' },
    { number: 25, b1: 2450, b2: 670, delta: '-73%', text: 'Tofu, Broccoli', base1: 'riso_bianco', p1: 'salmone', base2: 'patate', p2: 'tofu' },
    { number: 26, b1: 2600, b2: 710, delta: '-73%', text: 'Lenticchie, Farro', base1: 'riso_bianco', p1: 'pollo', base2: 'riso_integrale', p2: 'ceci' },
    { number: 27, b1: 2100, b2: 650, delta: '-69%', text: 'Piselli, Carote', base1: 'noodles', p1: 'feta', base2: 'patate', p2: 'ceci' },
    { number: 28, b1: 2750, b2: 690, delta: '-75%', text: 'Fagioli, Patate', base1: 'riso_bianco', p1: 'suino', base2: 'patate', p2: 'ceci' }
  ]

  async function handleCreateSession() {
    try {
      isLoading = true
      errorMessage = ''
      session = await createSession()
      participantCount = 0
      summary = []
      useDemoData = false
      isFinalized = false
    } catch (error) {
      errorMessage = 'Errore nella creazione della sessione.'
      console.error(error)
    } finally {
      isLoading = false
    }
  }

  async function refreshData() {
    if (!session || session.id === 'demo-session') return
    try {
      const [latestSession, pCount, classSummary] = await Promise.all([
        fetchSession(session.id),
        countParticipants(session.id),
        fetchClassSummary(session.id)
      ])

      session = latestSession
      participantCount = pCount
      summary = classSummary
      if (classSummary.length > 0) {
        useDemoData = false
      }
      if (session.phase === 3) {
        isFinalized = true
      }
    } catch (error) {
      console.error(error)
    }
  }

  onMount(() => {
    refreshData()
    pollHandle = window.setInterval(refreshData, 4000)
  })

  onDestroy(() => {
    if (pollHandle) window.clearInterval(pollHandle)
  })

  async function setPhase(phase: 1 | 2) {
    if (!session) return
    if (session.id === 'demo-session') {
      session.phase = phase
      return
    }
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
    if (session.id === 'demo-session') {
      session.phase = 3
      isFinalized = true
      return
    }
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

  // Active student list (real or demo)
  $: activeList = useDemoData
    ? DEMO_STUDENTS.map((d, i) => ({
        participantId: `demo-${d.number}`,
        participantNumber: d.number,
        bowl1: {
          id: `b1-${d.number}`,
          session_id: session.id,
          participant_id: `demo-${d.number}`,
          phase: 1 as const,
          size: 'regular' as const,
          base_id: d.base1,
          protein_ids: [d.p1],
          ingredient_ids: ['avocado', 'pomodorini'],
          total_co2_g: d.b1,
          total_km: d.b1 / DIESEL_CO2_PER_KM,
          created_at: new Date().toISOString()
        },
        bowl2: {
          id: `b2-${d.number}`,
          session_id: session.id,
          participant_id: `demo-${d.number}`,
          phase: 2 as const,
          size: 'regular' as const,
          base_id: d.base2,
          protein_ids: [d.p2],
          ingredient_ids: ['pomodorini', 'noci'],
          total_co2_g: d.b2,
          total_km: d.b2 / DIESEL_CO2_PER_KM,
          created_at: new Date().toISOString()
        },
        displayText: d.text
      }))
    : summary.map((s, i) => ({
        ...s,
        displayText: s.bowl2?.protein_ids?.map((id) => getIngredient(id)?.label).join(', ') || (s.bowl1 ? 'Fase 1 completata' : 'In attesa')
      }))

  $: studentsWithBothBowls = activeList.filter((s) => s.bowl1 && s.bowl2)

  $: totalCo2Bowl1 = studentsWithBothBowls.reduce((acc, s) => acc + (s.bowl1?.total_co2_g ?? 0), 0)
  $: totalCo2Bowl2 = studentsWithBothBowls.reduce((acc, s) => acc + (s.bowl2?.total_co2_g ?? 0), 0)
  $: totalCo2Saved = Math.max(0, totalCo2Bowl1 - totalCo2Bowl2)
  $: totalKgSaved = (totalCo2Saved / 1000).toFixed(1)
  $: totalKmSaved = (totalCo2Saved / DIESEL_CO2_PER_KM).toFixed(1)

  $: avgBowl1Co2 =
    studentsWithBothBowls.length > 0 ? Math.round(totalCo2Bowl1 / studentsWithBothBowls.length) : (useDemoData ? 2450 : 0)

  $: avgBowl2Co2 =
    studentsWithBothBowls.length > 0 ? Math.round(totalCo2Bowl2 / studentsWithBothBowls.length) : (useDemoData ? 780 : 0)

  $: avgPercentReduction =
    avgBowl1Co2 > 0 && avgBowl2Co2 > 0 ? Math.round(((avgBowl1Co2 - avgBowl2Co2) / avgBowl1Co2) * 100) : (useDemoData ? 68 : 0)

  $: improvedCount = studentsWithBothBowls.filter(
    (s) => (s.bowl1?.total_co2_g ?? 0) > (s.bowl2?.total_co2_g ?? 0)
  ).length

  $: percentImproved =
    studentsWithBothBowls.length > 0 ? Math.round((improvedCount / studentsWithBothBowls.length) * 100) : (useDemoData ? 100 : 0)

  $: sortedStudents = [...activeList].sort((a, b) => {
    if (sortBy === 'delta') {
      const deltaA = (a.bowl1?.total_co2_g ?? 0) - (a.bowl2?.total_co2_g ?? 0)
      const deltaB = (b.bowl1?.total_co2_g ?? 0) - (b.bowl2?.total_co2_g ?? 0)
      return deltaB - deltaA
    }
    return (a.participantNumber ?? 999) - (b.participantNumber ?? 999)
  })

  $: selectedStudent = sortedStudents[selectedStudentIndex] ?? sortedStudents[0]

  $: joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/bowl/?code=${session.code}`
      : ''
</script>

<div class="bg-background font-body-md text-body-md text-on-surface min-h-screen flex flex-col">
  <!-- Top Nav matching Stitch 05 -->
  <header class="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(27,77,62,0.06)]">
    <div class="h-20 w-full px-margin md:px-margin-desktop flex items-center justify-between gap-gutter">
      <div class="flex items-center gap-space-md">
        <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-secondary-fixed shadow-[0_2px_8px_-2px_rgba(27,77,62,0.12)]">
          <span class="material-symbols-outlined text-[24px]">nest_eco_leaf</span>
        </div>
        <div class="flex flex-col">
          <span class="font-headline-sm text-headline-sm text-primary tracking-tight">Crea la tua Bowl</span>
          <span class="font-label-sm text-label-sm text-on-surface-variant font-medium tracking-wide">
            UniSi Ecodynamics Group • Ricerca e Sostenibilità
          </span>
        </div>
      </div>

      <nav class="hidden lg:flex items-center gap-space-xs p-space-xs bg-surface-container-low rounded-xl">
        <button
          type="button"
          on:click={() => dispatch('exit')}
          class="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
        >
          Accesso e Ruoli
        </button>
        <button
          type="button"
          class="px-space-md py-space-sm transition-colors bg-secondary-container text-on-secondary-container font-label-lg rounded-xl"
        >
          Docente Projector
        </button>
        <button
          type="button"
          on:click={() => dispatch('exit')}
          class="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
        >
          Student Experience
        </button>
        <a
          href="#metodologia"
          class="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
        >
          Metodologia LCA
        </a>
      </nav>

      <div class="flex items-center gap-space-md">
        <div class="hidden sm:flex items-center gap-space-xs px-space-sm py-space-xs rounded-full bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(27,77,62,0.04)]">
          <span class="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
          <span class="font-label-sm text-label-sm text-on-surface-variant">Sessione Live Attiva</span>
        </div>
        <button
          type="button"
          on:click={() => dispatch('exit')}
          title="Torna alla Home"
          class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary hover:opacity-90 transition-opacity"
        >
          <span class="material-symbols-outlined text-on-primary text-[18px]">person</span>
        </button>
      </div>
    </div>
  </header>

  <!-- LIM Projector Main Body -->
  <main class="w-full pt-20 bg-background flex-1">
    <div class="flex flex-col w-full">
      
      <!-- Monitor Section matching Stitch 05 -->
      <section class="w-full bg-surface-container-low px-margin md:px-margin-desktop py-space-md shadow-sm">
        <div class="w-full flex flex-col xl:flex-row items-center justify-between gap-space-md max-w-7xl mx-auto">
          
          <div class="flex items-center gap-space-md w-full xl:w-auto justify-between xl:justify-start">
            <div class="flex flex-col">
              <div class="flex items-center gap-space-xs">
                <span class="font-headline-sm text-headline-sm text-primary tracking-tight">Ecodynamics Classroom Monitor</span>
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold animate-pulse">
                  <span class="w-2 h-2 rounded-full bg-secondary"></span>
                  SESSIONE ATTIVA
                </span>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Crea la tua Bowl • LIM Projector Engine 16:9
              </span>
            </div>
          </div>

          <!-- Class PIN & Fullscreen QR button -->
          <div class="flex items-center gap-space-sm bg-surface-container-lowest p-space-xs rounded-xl shadow-sm">
            <div class="flex items-center px-space-md py-space-xs bg-primary text-on-primary rounded-lg">
              <span class="font-label-sm text-label-sm tracking-widest text-primary-fixed mr-2 uppercase">PIN CLASSE:</span>
              <span class="font-headline-md text-headline-md tracking-widest font-extrabold text-secondary-fixed select-all">
                {session.code}
              </span>
            </div>
            <button
              type="button"
              on:click={() => (showQrModal = true)}
              class="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg transition-colors shadow-sm"
              id="qr-toggle-btn"
            >
              <span class="material-symbols-outlined text-[20px] text-primary">qr_code_scanner</span>
              <span class="hidden sm:inline">Mostra QR Schermo Intero</span>
            </button>
          </div>

          <!-- Connected Students & Stepper -->
          <div class="flex items-center gap-space-md flex-wrap justify-center xl:justify-end">
            <div class="flex items-center gap-space-xs px-space-md py-space-sm rounded-xl bg-surface-container-lowest text-on-surface shadow-sm">
              <span class="relative flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
              </span>
              <span class="font-headline-sm text-headline-sm text-primary font-bold">{participantCount}</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Studenti Collegati</span>
            </div>

            <!-- Stepper Badges matching Stitch 05 -->
            <div class="flex items-center bg-surface-container-lowest p-1 rounded-xl shadow-sm">
              <button
                type="button"
                on:click={() => setPhase(1)}
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg {session.phase === 1 ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant opacity-75'} font-label-sm text-label-sm transition-all"
              >
                <span class="material-symbols-outlined text-[16px] {session.phase >= 1 ? 'text-secondary' : ''}">check_circle</span>
                <span>1. Cieca</span>
              </button>
              <button
                type="button"
                on:click={() => setPhase(2)}
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg {session.phase === 2 ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant opacity-75'} font-label-sm text-label-sm transition-all"
              >
                <span class="material-symbols-outlined text-[16px] {session.phase >= 2 ? 'text-secondary' : ''}">check_circle</span>
                <span>2. Consapevole</span>
              </button>
              <button
                type="button"
                on:click={handleFinalize}
                class="flex items-center gap-1 px-3 py-1.5 rounded-lg {session.phase === 3 ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant opacity-75'} font-label-sm text-label-sm transition-all"
              >
                <span class="material-symbols-outlined text-[16px] text-secondary-fixed">auto_graph</span>
                <span>3. Risultati Classe</span>
              </button>
            </div>
          </div>

        </div>
      </section>

      <div class="w-full px-margin md:px-margin-desktop py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto">
        
        <!-- 4 KPI Metrics matching Stitch 05 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <!-- KPI 1 -->
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden">
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

          <!-- KPI 2 -->
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden">
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
              <span>Pari a tratta <span class="font-semibold text-on-surface">Roma • Firenze • Siena</span></span>
            </div>
          </div>

          <!-- KPI 3 -->
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden">
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
              <span class="font-semibold text-primary">{improvedCount} studenti su {studentsWithBothBowls.length}</span>
              <span>hanno ridotto l'impatto</span>
            </div>
          </div>

          <!-- KPI 4 -->
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-md flex flex-col justify-between relative overflow-hidden">
            <div class="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-tertiary-fixed/30 pointer-events-none blur-xl"></div>
            <div class="flex items-start justify-between">
              <span class="font-label-sm text-label-sm text-on-surface-variant font-bold uppercase tracking-wider">Proteina Rivoluzionata</span>
              <span class="p-2 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed">
                <span class="material-symbols-outlined text-[24px]">psychology_alt</span>
              </span>
            </div>
            <div class="my-space-sm">
              <div class="font-metric-display text-metric-display text-tertiary tracking-tight">
                82% <span class="text-headline-md font-body-md text-on-surface-variant font-semibold">Shift</span>
              </div>
            </div>
            <div class="flex items-center gap-1 text-on-surface-variant font-label-md text-label-md">
              <span class="material-symbols-outlined text-[16px] text-tertiary">swap_horiz</span>
              <span>Sostituiti manzo/salmone con legumi</span>
            </div>
          </div>
        </div>

        <!-- 12 Columns Section: Collective Chart vs Spotlight Card -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
          
          <!-- Collective LCA Comparison (7 cols) -->
          <div class="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-lg shadow-md flex flex-col justify-between">
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

              <div class="w-full mt-space-md flex flex-col gap-space-lg">
                <!-- Bar 1 -->
                <div class="flex flex-col gap-space-xs">
                  <div class="flex justify-between items-baseline">
                    <span class="font-title-md text-title-md text-on-surface font-semibold flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-error"></span>
                      Media Bowl 1: Scelta Cieca (Iniziale)
                    </span>
                    <span class="font-headline-sm text-headline-sm font-extrabold text-error">2.450 g CO₂e</span>
                  </div>
                  <div class="w-full bg-surface-container h-9 rounded-xl overflow-hidden p-1 flex items-center shadow-inner">
                    <div class="bg-error/90 h-full rounded-lg transition-all duration-1000 flex items-center justify-end pr-3 text-on-error font-label-sm text-label-sm font-bold" style="width: 82%;">
                      +308% sopra target EAT-Lancet
                    </div>
                  </div>
                  <span class="font-label-sm text-label-sm text-on-surface-variant">
                    Elevato impatto derivato da carne rossa, pesce d'importazione e ingredienti aerei.
                  </span>
                </div>

                <!-- Bar 2 -->
                <div class="flex flex-col gap-space-xs">
                  <div class="flex justify-between items-baseline">
                    <span class="font-title-md text-title-md text-on-surface font-semibold flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                      Media Bowl 2: Scelta Consapevole (LCA Guidata)
                    </span>
                    <span class="font-headline-sm text-headline-sm font-extrabold text-secondary">780 g CO₂e</span>
                  </div>
                  <div class="w-full bg-surface-container h-9 rounded-xl overflow-hidden p-1 flex items-center shadow-inner">
                    <div class="bg-secondary h-full rounded-lg transition-all duration-1000 flex items-center justify-end pr-3 text-on-secondary font-label-sm text-label-sm font-bold" style="width: 26%;">
                      Riduzione -68.1%
                    </div>
                  </div>
                  <span class="font-label-sm text-label-sm text-on-surface-variant">
                    Predilezione per legumi toscani, cereali rustici, verdure di stagione a km zero.
                  </span>
                </div>

                <!-- Target line -->
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
                    La classe ha ridotto il divario rispetto alla soglia di sicurezza climatica planetaria di oltre l'80% in un singolo ciclo didattico.
                  </p>
                </div>
              </div>
            </div>

            <div class="mt-space-lg pt-space-md bg-surface-container-low p-space-md rounded-xl flex items-center justify-between">
              <div class="flex items-center gap-space-sm">
                <span class="material-symbols-outlined text-[28px] text-primary">insights</span>
                <div class="flex flex-col">
                  <span class="font-title-md text-title-md font-bold text-primary">Differenziale Netto della Classe</span>
                  <span class="font-body-sm text-body-sm text-on-surface-variant">Risparmio medio individuale: 1.670 g CO₂e per porzione</span>
                </div>
              </div>
              <div class="px-space-md py-space-xs rounded-xl bg-secondary text-on-secondary font-headline-sm text-headline-sm font-extrabold">
                -68%
              </div>
            </div>
          </div>

          <!-- Student Spotlight Discussion Card (5 cols) matching Stitch 05 -->
          <div class="lg:col-span-5 bg-primary text-on-primary rounded-xl p-space-lg shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div class="absolute top-0 right-0 w-64 h-64 bg-secondary-fixed/10 rounded-full blur-3xl pointer-events-none"></div>

            <div>
              <div class="flex items-center justify-between mb-space-sm">
                <span class="px-space-sm py-1 rounded-full bg-primary-container text-secondary-fixed font-label-sm text-label-sm font-bold uppercase tracking-wider">
                  Focus Discussione in Aula
                </span>
                <span class="font-label-sm text-label-sm text-primary-fixed-dim">
                  ID: #{selectedStudent?.participantNumber ?? 17} {selectedStudent?.participantNumber === 17 ? '(Caso Studio)' : ''}
                </span>
              </div>

              <h3 class="font-headline-md text-headline-md text-surface tracking-tight mb-space-md">
                Studente Anonimo #{selectedStudent?.participantNumber ?? 17}: Anatomia di un Cambio Radicale
              </h3>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm mb-space-md">
                <!-- 1. CIÈCA -->
                <div class="bg-primary-container p-space-sm rounded-xl">
                  <div class="flex items-center justify-between pb-2 mb-2 bg-surface/5 p-1 rounded-lg">
                    <span class="font-label-sm text-label-sm font-bold text-tertiary-fixed">1. CIÈCA</span>
                    <span class="font-title-md text-title-md font-extrabold text-error-container">
                      {selectedStudent?.bowl1 ? `${selectedStudent.bowl1.total_co2_g} g` : '2.626 g'}
                    </span>
                  </div>
                  <ul class="flex flex-col gap-1.5 font-label-md text-label-md text-inverse-on-surface">
                    <li class="flex justify-between items-center">
                      <span>Riso bianco</span>
                      <span class="font-semibold text-primary-fixed-dim">365g</span>
                    </li>
                    <li class="flex justify-between items-center bg-error/20 px-1 rounded">
                      <span class="font-bold text-error-container">Salmone Norvegia</span>
                      <span class="font-bold text-error-container">2.045g</span>
                    </li>
                    <li class="flex justify-between items-center">
                      <span>Avocado Sudamerica</span>
                      <span class="font-semibold text-primary-fixed-dim">254g</span>
                    </li>
                  </ul>
                </div>

                <!-- 2. CONSAPEVOLE -->
                <div class="bg-primary-container p-space-sm rounded-xl">
                  <div class="flex items-center justify-between pb-2 mb-2 bg-secondary-container/20 p-1 rounded-lg">
                    <span class="font-label-sm text-label-sm font-bold text-secondary-fixed">2. CONSAPEVOLE</span>
                    <span class="font-title-md text-title-md font-extrabold text-secondary-fixed">
                      {selectedStudent?.bowl2 ? `${selectedStudent.bowl2.total_co2_g} g` : '735 g'}
                    </span>
                  </div>
                  <ul class="flex flex-col gap-1.5 font-label-md text-label-md text-inverse-on-surface">
                    <li class="flex justify-between items-center">
                      <span>Patate lesse</span>
                      <span class="font-semibold text-secondary-fixed-dim">92g</span>
                    </li>
                    <li class="flex justify-between items-center bg-secondary/30 px-1 rounded">
                      <span class="font-bold text-secondary-fixed">Ceci Toscani km0</span>
                      <span class="font-bold text-secondary-fixed">90g</span>
                    </li>
                    <li class="flex justify-between items-center">
                      <span>Pomodorini freschi</span>
                      <span class="font-semibold text-secondary-fixed-dim">118g</span>
                    </li>
                    <li class="flex justify-between items-center">
                      <span>Noci nostrane</span>
                      <span class="font-semibold text-secondary-fixed-dim">13g</span>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Debate Guide -->
              <div class="p-space-sm rounded-xl bg-surface/10 backdrop-blur-md">
                <div class="flex items-start gap-space-xs">
                  <span class="material-symbols-outlined text-secondary-fixed text-[24px]">forum</span>
                  <div class="flex flex-col">
                    <span class="font-label-sm text-label-sm font-bold text-secondary-fixed uppercase tracking-wider">
                      Guida Docente per il Dibattito
                    </span>
                    <p class="font-body-md text-body-md text-surface-bright mt-1 leading-snug">
                      “Perché la sola sostituzione del <strong>Salmone di allevamento</strong> con i <strong>Ceci toscani</strong> ha generato oltre l'<strong>85%</strong> dell'intero risparmio di carbonio di questa bowl?”
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-space-md pt-space-xs flex items-center justify-between">
              <span class="font-label-sm text-label-sm text-primary-fixed-dim">Delta Individuale: -72.0%</span>
              <button
                type="button"
                on:click={() => (showQrModal = true)}
                class="px-space-md py-space-xs rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md font-bold hover:bg-secondary-fixed-dim transition-colors shadow-sm"
              >
                Proietta Ricetta Dettagliata
              </button>
            </div>

          </div>
        </div>

        <!-- Mappa Anonima dei Partecipanti (28 Student Grid) -->
        <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-md">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm mb-space-md">
            <div>
              <div class="flex items-center gap-space-xs">
                <span class="font-headline-md text-headline-md text-primary font-bold">Mappa Anonima dei Partecipanti</span>
                <span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
                  {useDemoData ? '28 / 28 Completati' : `${studentsWithBothBowls.length} / ${participantCount} Completati`}
                </span>
              </div>
              <span class="font-body-sm text-body-sm text-on-surface-variant">
                Clicca su una scheda studente per aggiornare il riquadro di analisi collettiva o proiettare la sua bowl.
              </span>
            </div>

            <div class="flex items-center gap-space-xs">
              <span class="font-label-sm text-label-sm text-on-surface-variant">Ordina per:</span>
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

          <!-- 7-column grid matching Stitch 05 -->
          {#if sortedStudents.length === 0}
            <div class="py-12 text-center col-span-full text-on-surface-variant flex flex-col items-center justify-center p-space-lg rounded-xl bg-surface-container-low border border-dashed border-outline-variant">
              <span class="material-symbols-outlined text-[48px] text-secondary mb-2">group_add</span>
              <p class="font-headline-sm text-headline-sm font-bold text-primary">In attesa dei primi studenti...</p>
              <p class="font-body-md text-body-md mt-1">Invita la classe a collegarsi digitando il PIN <span class="font-mono font-extrabold text-secondary tracking-widest text-lg px-2 py-0.5 rounded bg-surface-container-lowest shadow-sm">{session.code}</span> oppure proietta il QR code a schermo intero.</p>
            </div>
          {:else}
            <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-space-sm" id="students-wall">
              {#each sortedStudents as student, idx}
                {@const isSelected = selectedStudent?.participantId === student.participantId}
                {@const numStr = String(student.participantNumber ?? (idx + 1)).padStart(2, '0')}
                <button
                  type="button"
                  on:click={() => (selectedStudentIndex = idx)}
                  class="cursor-pointer p-space-sm rounded-xl transition-all hover:-translate-y-0.5 shadow-sm flex flex-col justify-between text-left {isSelected ? 'bg-secondary-container text-on-secondary-container ring-2 ring-secondary' : 'bg-surface-container-low hover:bg-surface-container text-on-surface'}"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="font-label-sm text-label-sm font-bold text-on-surface-variant">#{numStr}</span>
                    <span class="font-label-sm text-label-sm px-1.5 py-0.5 rounded {isSelected ? 'bg-primary text-on-primary' : 'bg-secondary-container text-on-secondary-container'} font-extrabold">
                      -{student.bowl1 && student.bowl2 ? Math.round(((student.bowl1.total_co2_g - student.bowl2.total_co2_g) / student.bowl1.total_co2_g) * 100) : (useDemoData ? 70 : 0)}%
                    </span>
                  </div>
                  <div class="my-1.5 flex flex-col font-label-sm text-label-sm">
                    <span class="text-error font-medium">{student.bowl1?.total_co2_g ?? 0}g</span>
                    <span class="text-secondary font-bold text-title-md">{student.bowl2?.total_co2_g ?? 0}g</span>
                  </div>
                  <span class="font-label-sm text-label-sm text-on-surface-variant truncate w-full">
                    {student.displayText}
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- LIM Bottom Control Bar matching Stitch 05 -->
        <div class="w-full bg-surface-container-low rounded-xl p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-md shadow-sm">
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
              <span class="material-symbols-outlined text-[20px]">download</span>
              <span>Esporta Report LCA (.PDF)</span>
            </button>
            <button
              type="button"
              on:click={handleCreateSession}
              class="px-space-md py-space-sm rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <span class="material-symbols-outlined text-[20px] text-secondary-fixed">replay</span>
              <span>Avvia Nuova Sessione</span>
            </button>
          </div>
        </div>

      </div>

      <!-- QR Modal matching Stitch 05 -->
      {#if showQrModal}
        <div class="fixed inset-0 z-50 bg-on-surface/80 backdrop-blur-md flex items-center justify-center p-space-md" id="qr-modal">
          <div class="bg-surface-container-lowest rounded-xl max-w-xl w-full p-space-lg shadow-2xl flex flex-col items-center text-center relative">
            <button
              type="button"
              on:click={() => (showQrModal = false)}
              class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-2 rounded-lg bg-surface-container"
              id="qr-close-btn"
            >
              <span class="material-symbols-outlined text-[24px]">close</span>
            </button>
            
            <span class="font-label-sm text-label-sm font-bold text-secondary uppercase tracking-widest mb-1">
              Scansiona con Smartphone
            </span>
            <h3 class="font-headline-lg text-headline-lg text-primary mb-2 font-bold">Entra nella Sfida della Bowl</h3>
            <p class="font-body-md text-body-md text-on-surface-variant mb-space-md">
              Inquadra il codice QR con la fotocamera per partecipare alla sessione di classe
            </p>

            <div class="p-space-md bg-surface-container-low rounded-xl shadow-inner flex items-center justify-center mb-space-md">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&data={encodeURIComponent(joinUrl)}&bgcolor=faf8ff&color=003629"
                alt="QR Code per sessione {session.code}"
                class="w-64 h-64 rounded-xl shadow-sm"
              />
            </div>

            <div class="flex flex-col items-center">
              <span class="font-label-sm text-label-sm text-on-surface-variant">Oppure vai su <span class="font-bold text-primary">ecopanel.frisma.org/bowl/</span> e digita:</span>
              <div class="mt-2 px-space-md py-space-xs rounded-xl bg-primary text-secondary-fixed font-metric-display text-metric-display tracking-widest font-extrabold shadow-md">
                {session.code}
              </div>
            </div>
          </div>
        </div>
      {/if}

    </div>
  </main>

  <footer class="w-full bg-surface-container-low py-space-lg">
    <div class="w-full px-margin md:px-margin-desktop flex flex-col md:flex-row items-center justify-between gap-space-md text-on-surface-variant max-w-7xl mx-auto">
      <div class="flex items-center gap-space-xs font-label-sm text-label-sm">
        <span class="material-symbols-outlined text-[16px] text-primary">science</span>
        <span>Progetto Scientifico a cura di Ecodynamics Group • Università degli Studi di Siena</span>
      </div>
      <div class="font-label-sm text-label-sm">
        © 2024–2026 Crea la tua Bowl. Indicatori ambientali calcolati secondo Life Cycle Assessment (LCA).
      </div>
    </div>
  </footer>
</div>
