<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import {
    createSession,
    countParticipants,
    fetchClassSummary,
    finalizeSessionAndAssignNumbers,
    updateSessionPhase,
    fetchSession,
    fetchAllSessions,
    deleteSession,
    fetchSessionsWithStats
  } from './api'
  import type { ClassSummaryRow, Session, SessionStats } from './api'
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

  // Modals & Navigation
  let showQrModal = false
  let showSessionsModal = false
  let showComparisonModal = false

  // Multi-Session Management state
  let allSessionStats: SessionStats[] = []
  let isSessionsLoading = false
  let sessionActionError = ''
  let sessionSearch = ''
  let sessionFilter: 'all' | 'active' | 'closed' = 'all'
  let selectedSessionIdsForComparison: string[] = []
  let sessionToDelete: Session | null = null

  // UI state
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

  const DEMO_SESSION_STATS: SessionStats = {
    session: {
      id: 'demo-session',
      code: 'NMLHM (Demo)',
      phase: 3,
      created_at: new Date().toISOString()
    },
    participantCount: 28,
    bowl1Count: 28,
    bowl2Count: 28,
    completedCount: 28,
    avgCo2Bowl1: 2450,
    avgCo2Bowl2: 780,
    avgCo2Saved: 1670,
    percentReduction: 68,
    totalKgSaved: 46.8,
    totalKmSaved: 360.0,
    eatLancetPassCount: 7,
    eatLancetPassPercent: 25,
    topProteinFase1: 'salmone',
    topProteinFase2: 'ceci'
  }

  function formatDate(isoString: string): string {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      return d.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return isoString
    }
  }

  async function loadSessions() {
    isSessionsLoading = true
    sessionActionError = ''
    try {
      const realStats = await fetchSessionsWithStats()
      allSessionStats = realStats
    } catch (err) {
      console.error(err)
      sessionActionError = 'Errore nel caricamento delle sessioni.'
    } finally {
      isSessionsLoading = false
    }
  }

  function openSessionsManager() {
    showSessionsModal = true
    loadSessions()
  }

  function selectSession(s: Session) {
    session = s
    selectedStudentIndex = 0
    useDemoData = s.id === 'demo-session'
    isFinalized = s.phase === 3
    showSessionsModal = false
    showComparisonModal = false
    refreshData()
  }

  function switchToDemoSession() {
    session = {
      id: 'demo-session',
      code: 'NMLHM',
      phase: 3,
      created_at: new Date().toISOString()
    }
    useDemoData = true
    isFinalized = true
    participantCount = 28
    summary = []
    selectedStudentIndex = 0
    showSessionsModal = false
    showComparisonModal = false
  }

  async function handleCloseSessionDirect(sessionId: string) {
    try {
      isSessionsLoading = true
      sessionActionError = ''
      await finalizeSessionAndAssignNumbers(sessionId)
      if (session.id === sessionId) {
        session = { ...session, phase: 3 }
        isFinalized = true
        await refreshData()
      }
      await loadSessions()
    } catch (err) {
      console.error(err)
      sessionActionError = 'Errore durante la conclusione della sessione.'
    } finally {
      isSessionsLoading = false
    }
  }

  async function handleReopenSessionDirect(sessionId: string) {
    try {
      isSessionsLoading = true
      sessionActionError = ''
      await updateSessionPhase(sessionId, 2)
      if (session.id === sessionId) {
        session = { ...session, phase: 2 }
        isFinalized = false
        await refreshData()
      }
      await loadSessions()
    } catch (err) {
      console.error(err)
      sessionActionError = 'Errore durante la riapertura della sessione.'
    } finally {
      isSessionsLoading = false
    }
  }

  async function handleConfirmDelete() {
    if (!sessionToDelete) return
    try {
      isSessionsLoading = true
      sessionActionError = ''
      await deleteSession(sessionToDelete.id)
      selectedSessionIdsForComparison = selectedSessionIdsForComparison.filter(
        (id) => id !== sessionToDelete?.id
      )
      if (session.id === sessionToDelete.id) {
        switchToDemoSession()
      }
      sessionToDelete = null
      await loadSessions()
    } catch (err) {
      console.error(err)
      sessionActionError = "Errore durante l'eliminazione della sessione."
    } finally {
      isSessionsLoading = false
    }
  }

  function toggleCompareSelection(id: string) {
    if (selectedSessionIdsForComparison.includes(id)) {
      selectedSessionIdsForComparison = selectedSessionIdsForComparison.filter((x) => x !== id)
    } else {
      selectedSessionIdsForComparison = [...selectedSessionIdsForComparison, id]
    }
  }

  async function openComparison() {
    showSessionsModal = false
    if (allSessionStats.length === 0) {
      await loadSessions()
    }
    if (selectedSessionIdsForComparison.length < 2) {
      const real = allSessionStats.map((s) => s.session.id)
      if (real.length > 0) {
        selectedSessionIdsForComparison = ['demo-session', real[0]]
      } else {
        selectedSessionIdsForComparison = ['demo-session']
      }
    }
    showComparisonModal = true
  }

  async function handleCreateSession() {
    try {
      isLoading = true
      errorMessage = ''
      session = await createSession()
      participantCount = 0
      summary = []
      useDemoData = false
      isFinalized = false
      selectedStudentIndex = 0
      loadSessions()
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

  onMount(async () => {
    refreshData()
    pollHandle = window.setInterval(refreshData, 4000)

    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      if (p.get('modal') === 'sessions') {
        openSessionsManager()
      } else if (p.get('modal') === 'compare' || p.get('modal') === 'comparison') {
        await openComparison()
      }
    }
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

  $: sessionsForListing = [DEMO_SESSION_STATS, ...allSessionStats]

  $: filteredSessions = sessionsForListing.filter((s) => {
    const matchesSearch =
      sessionSearch.trim() === '' ||
      s.session.code.toLowerCase().includes(sessionSearch.toLowerCase())
    if (!matchesSearch) return false

    if (sessionFilter === 'active') return s.session.phase === 1 || s.session.phase === 2
    if (sessionFilter === 'closed') return s.session.phase === 3
    return true
  })

  $: comparedSessionsList = sessionsForListing.filter((s) =>
    selectedSessionIdsForComparison.includes(s.session.id)
  )

  $: leaderSession = comparedSessionsList
    .filter((s) => s.completedCount > 0 && s.percentReduction > 0)
    .reduce<SessionStats | null>((best, curr) => {
      if (!best) return curr
      return curr.percentReduction > best.percentReduction ? curr : best
    }, null)

  $: totalComparisonKgSaved = Number(
    comparedSessionsList.reduce((sum, s) => sum + s.totalKgSaved, 0).toFixed(1)
  )

  $: totalComparisonKmSaved = Number(
    comparedSessionsList.reduce((sum, s) => sum + s.totalKmSaved, 0).toFixed(1)
  )

  $: totalComparisonStudents = comparedSessionsList.reduce(
    (sum, s) => sum + s.participantCount,
    0
  )

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
          class="px-space-md py-space-sm transition-colors bg-secondary-container text-on-secondary-container font-label-lg rounded-xl font-bold"
        >
          Docente Projector
        </button>
        <button
          type="button"
          on:click={openSessionsManager}
          class="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-primary hover:bg-surface-container transition-colors flex items-center gap-1.5 font-bold"
        >
          <span class="material-symbols-outlined text-[18px]">folder_shared</span>
          <span>Gestione Sessioni</span>
        </button>
        <button
          type="button"
          on:click={openComparison}
          class="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-secondary hover:bg-surface-container transition-colors flex items-center gap-1.5 font-bold"
        >
          <span class="material-symbols-outlined text-[18px]">compare_arrows</span>
          <span>Confronta Classi</span>
        </button>
        <button
          type="button"
          on:click={() => dispatch('exit')}
          class="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
        >
          Student Experience
        </button>
      </nav>

      <div class="flex items-center gap-space-md">
        <div class="hidden sm:flex items-center gap-space-xs px-space-sm py-space-xs rounded-full bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(27,77,62,0.04)]">
          <span class="w-2 h-2 rounded-full {session.phase === 3 ? 'bg-secondary-fixed-dim' : 'bg-secondary animate-pulse'}"></span>
          <span class="font-label-sm text-label-sm text-on-surface-variant font-semibold">
            {session.phase === 3 ? 'Sessione Conclusa' : 'Sessione Live Attiva'}
          </span>
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
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full {session.phase === 3 ? 'bg-surface-container text-on-surface-variant' : 'bg-secondary-container text-on-secondary-container animate-pulse'} font-label-sm text-label-sm font-bold">
                  <span class="w-2 h-2 rounded-full {session.phase === 3 ? 'bg-on-surface-variant' : 'bg-secondary'}"></span>
                  {session.phase === 3 ? 'SESSIONE CONCLUSA' : 'SESSIONE ATTIVA'}
                </span>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Crea la tua Bowl • LIM Projector Engine 16:9
              </span>
            </div>
          </div>

          <!-- Class PIN & Actions: Switcher, Compare, Fullscreen QR -->
          <div class="flex items-center gap-space-sm bg-surface-container-lowest p-space-xs rounded-xl shadow-sm flex-wrap justify-center">
            <div class="flex items-center px-space-md py-space-xs bg-primary text-on-primary rounded-lg">
              <span class="font-label-sm text-label-sm tracking-widest text-primary-fixed mr-2 uppercase">PIN CLASSE:</span>
              <span class="font-headline-md text-headline-md tracking-widest font-extrabold text-secondary-fixed select-all">
                {session.code}
              </span>
            </div>

            <button
              type="button"
              on:click={openSessionsManager}
              class="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg transition-colors shadow-sm"
              title="Gestione e cambio sessioni didattiche"
            >
              <span class="material-symbols-outlined text-[20px] text-primary">folder_open</span>
              <span class="hidden sm:inline font-bold">Sessioni</span>
            </button>

            <button
              type="button"
              on:click={openComparison}
              class="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg transition-colors shadow-sm"
              title="Confronta risultati con altre classi"
            >
              <span class="material-symbols-outlined text-[20px] text-secondary">compare_arrows</span>
              <span class="hidden sm:inline font-bold">Confronta</span>
            </button>

            <button
              type="button"
              on:click={() => (showQrModal = true)}
              class="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg transition-colors shadow-sm"
              id="qr-toggle-btn"
              title="Mostra QR a schermo intero"
            >
              <span class="material-symbols-outlined text-[20px] text-primary">qr_code_scanner</span>
              <span class="hidden sm:inline">QR Code</span>
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

          <div class="flex items-center gap-space-sm flex-wrap">
            <button
              type="button"
              on:click={openSessionsManager}
              class="px-space-md py-space-sm rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <span class="material-symbols-outlined text-[20px] text-primary">folder_open</span>
              <span>Tutte le Sessioni</span>
            </button>
            <button
              type="button"
              on:click={openComparison}
              class="px-space-md py-space-sm rounded-xl bg-secondary-container hover:bg-secondary-fixed text-on-secondary-container font-label-lg text-label-lg transition-colors flex items-center gap-2 shadow-sm font-bold"
            >
              <span class="material-symbols-outlined text-[20px]">compare_arrows</span>
              <span>Confronta Classi</span>
            </button>
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
              <span class="material-symbols-outlined text-[20px] text-secondary-fixed">add_circle</span>
              <span>Nuova Sessione</span>
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

      <!-- Modale 1: Gestione Sessioni (Elenco, Cambio, Conclusione, Eliminazione) -->
      {#if showSessionsModal}
        <div class="fixed inset-0 z-50 bg-on-surface/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6" id="sessions-modal">
          <div class="bg-surface max-w-5xl w-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-outline-variant/30 text-on-surface">
            <!-- Header -->
            <div class="p-5 sm:p-6 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary text-secondary-fixed flex items-center justify-center shadow-sm">
                  <span class="material-symbols-outlined text-[24px]">folder_shared</span>
                </div>
                <div>
                  <h2 class="font-headline-sm text-headline-sm font-bold text-primary">Gestione Sessioni e Classi</h2>
                  <p class="font-body-sm text-body-sm text-on-surface-variant">
                    Visualizza lo storico, cambia la sessione attiva sul proiettore o seleziona più classi da confrontare.
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                {#if selectedSessionIdsForComparison.length >= 2}
                  <button
                    type="button"
                    on:click={openComparison}
                    class="px-4 py-2 rounded-xl bg-secondary text-on-secondary font-label-md text-label-md font-bold hover:bg-secondary/90 transition-all flex items-center gap-1.5 shadow-sm animate-bounce"
                  >
                    <span class="material-symbols-outlined text-[18px]">compare_arrows</span>
                    <span>Confronta ({selectedSessionIdsForComparison.length})</span>
                  </button>
                {/if}
                <button
                  type="button"
                  on:click={() => (showSessionsModal = false)}
                  class="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                >
                  <span class="material-symbols-outlined text-[24px]">close</span>
                </button>
              </div>
            </div>

            <!-- Controls & Search Toolbar -->
            <div class="p-4 sm:p-5 bg-surface-container-lowest border-b border-outline-variant/20 flex flex-col md:flex-row items-center justify-between gap-3">
              <!-- Search & Filter tabs -->
              <div class="flex items-center gap-3 w-full md:w-auto flex-wrap">
                <div class="relative w-full sm:w-64">
                  <span class="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">search</span>
                  <input
                    type="text"
                    bind:value={sessionSearch}
                    placeholder="Cerca PIN classe..."
                    class="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-label-md text-label-md focus:outline-none focus:ring-2 focus:ring-primary uppercase tracking-wider font-bold placeholder:normal-case placeholder:font-normal"
                  />
                </div>

                <div class="flex items-center p-1 rounded-xl bg-surface-container-low">
                  <button
                    type="button"
                    on:click={() => (sessionFilter = 'all')}
                    class="px-3 py-1.5 rounded-lg font-label-sm text-label-sm font-semibold transition-all {sessionFilter === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
                  >
                    Tutte ({sessionsForListing.length})
                  </button>
                  <button
                    type="button"
                    on:click={() => (sessionFilter = 'active')}
                    class="px-3 py-1.5 rounded-lg font-label-sm text-label-sm font-semibold transition-all {sessionFilter === 'active' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
                  >
                    In corso ({sessionsForListing.filter((s) => s.session.phase < 3).length})
                  </button>
                  <button
                    type="button"
                    on:click={() => (sessionFilter = 'closed')}
                    class="px-3 py-1.5 rounded-lg font-label-sm text-label-sm font-semibold transition-all {sessionFilter === 'closed' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
                  >
                    Concluse ({sessionsForListing.filter((s) => s.session.phase === 3).length})
                  </button>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  on:click={loadSessions}
                  class="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
                  title="Ricarica elenco sessioni"
                >
                  <span class="material-symbols-outlined text-[20px] {isSessionsLoading ? 'animate-spin' : ''}">refresh</span>
                </button>

                <button
                  type="button"
                  on:click={() => {
                    showSessionsModal = false
                    handleCreateSession()
                  }}
                  class="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-label-md text-label-md font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span class="material-symbols-outlined text-[18px] text-secondary-fixed">add</span>
                  <span>Nuova Classe</span>
                </button>
              </div>
            </div>

            {#if sessionActionError}
              <div class="px-5 py-2.5 bg-error-container text-on-error-container text-body-sm flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">error</span>
                <span>{sessionActionError}</span>
              </div>
            {/if}

            <!-- Sessions List -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-3">
              {#if filteredSessions.length === 0}
                <div class="py-12 text-center text-on-surface-variant flex flex-col items-center justify-center p-8 rounded-xl bg-surface-container-low border border-dashed border-outline-variant">
                  <span class="material-symbols-outlined text-[48px] text-primary/40 mb-2">folder_off</span>
                  <p class="font-headline-sm text-headline-sm font-bold text-primary">Nessuna sessione trovata</p>
                  <p class="font-body-md text-body-md mt-1">Crea una nuova classe per iniziare una prova interattiva.</p>
                </div>
              {:else}
                {#each filteredSessions as stat (stat.session.id)}
                  {@const isActiveSession = session.id === stat.session.id}
                  {@const isCheckedForCompare = selectedSessionIdsForComparison.includes(stat.session.id)}
                  <div
                    class="p-4 rounded-xl border transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 {isActiveSession ? 'bg-secondary-container/20 border-secondary ring-1 ring-secondary' : 'bg-surface-container-lowest border-outline-variant/40 hover:border-primary/40 shadow-sm'}"
                  >
                    <!-- Checkbox & PIN info -->
                    <div class="flex items-center gap-3">
                      <label class="flex items-center cursor-pointer p-1" title="Seleziona per confronto">
                        <input
                          type="checkbox"
                          checked={isCheckedForCompare}
                          on:change={() => toggleCompareSelection(stat.session.id)}
                          class="w-5 h-5 rounded border-outline-variant text-secondary focus:ring-secondary cursor-pointer"
                        />
                      </label>

                      <div class="flex flex-col">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-mono text-xl font-black text-primary tracking-widest bg-surface-container-low px-2.5 py-1 rounded-lg">
                            {stat.session.code}
                          </span>
                          {#if isActiveSession}
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm font-bold shadow-sm animate-pulse">
                              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                              ATTIVA ORA SULLA LIM
                            </span>
                          {/if}
                          {#if stat.session.phase === 1}
                            <span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-label-sm text-label-sm font-semibold">
                              Fase 1: Scelta alla Cieca
                            </span>
                          {:else if stat.session.phase === 2}
                            <span class="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 font-label-sm text-label-sm font-semibold">
                              Fase 2: Consapevole
                            </span>
                          {:else}
                            <span class="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                              Fase 3: Conclusa / Risultati
                            </span>
                          {/if}
                        </div>
                        <span class="font-label-sm text-label-sm text-on-surface-variant mt-1">
                          Creata il {formatDate(stat.session.created_at)}
                        </span>
                      </div>
                    </div>

                    <!-- Stats pills -->
                    <div class="flex items-center gap-3 flex-wrap font-label-sm text-label-sm text-on-surface-variant">
                      <div class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low">
                        <span class="material-symbols-outlined text-[16px] text-primary">groups</span>
                        <span class="font-bold text-on-surface">{stat.participantCount}</span> studenti
                      </div>

                      <div class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low">
                        <span class="material-symbols-outlined text-[16px] text-secondary">task_alt</span>
                        <span class="font-bold text-on-surface">{stat.completedCount}</span> completati
                      </div>

                      {#if stat.completedCount > 0}
                        <div class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary-container text-on-secondary-container font-bold">
                          <span class="material-symbols-outlined text-[16px]">trending_down</span>
                          <span>-{stat.percentReduction}% CO₂</span>
                        </div>
                        <div class="hidden xl:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low">
                          <span class="text-on-surface-variant font-medium">Media:</span>
                          <span class="font-bold text-primary">{stat.avgCo2Bowl2} g</span>
                        </div>
                      {/if}
                    </div>

                    <!-- Action buttons -->
                    <div class="flex items-center gap-2 self-end lg:self-center">
                      {#if !isActiveSession}
                        <button
                          type="button"
                          on:click={() => selectSession(stat.session)}
                          class="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-1 shadow-sm"
                          title="Visualizza e controlla questa sessione sulla LIM"
                        >
                          <span class="material-symbols-outlined text-[16px] text-secondary-fixed">play_circle</span>
                          <span>Carica su LIM</span>
                        </button>
                      {/if}

                      {#if stat.session.phase < 3}
                        <button
                          type="button"
                          on:click={() => handleCloseSessionDirect(stat.session.id)}
                          class="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-medium transition-colors flex items-center gap-1"
                          title="Chiudi sessione e calcola classifica anonima"
                        >
                          <span class="material-symbols-outlined text-[16px] text-primary">lock</span>
                          <span class="hidden sm:inline">Chiudi Sessione</span>
                        </button>
                      {:else if stat.session.id !== 'demo-session'}
                        <button
                          type="button"
                          on:click={() => handleReopenSessionDirect(stat.session.id)}
                          class="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-label-sm font-medium transition-colors flex items-center gap-1"
                          title="Riapri sessione per permettere altre modifiche"
                        >
                          <span class="material-symbols-outlined text-[16px] text-on-surface-variant">lock_open</span>
                          <span class="hidden sm:inline">Riapri</span>
                        </button>
                      {/if}

                      {#if stat.session.id !== 'demo-session'}
                        <button
                          type="button"
                          on:click={() => (sessionToDelete = stat.session)}
                          class="p-1.5 rounded-xl text-error hover:bg-error-container/40 transition-colors"
                          title="Elimina definitivamente questa sessione"
                        >
                          <span class="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>

            <!-- Footer -->
            <div class="p-4 bg-surface-container-low border-t border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-3 font-label-sm text-label-sm text-on-surface-variant">
              <div class="flex items-center gap-2">
                <span>Selezionate per confronto: <strong class="text-primary">{selectedSessionIdsForComparison.length}</strong></span>
                {#if selectedSessionIdsForComparison.length > 0}
                  <button
                    type="button"
                    on:click={() => (selectedSessionIdsForComparison = [])}
                    class="text-primary underline hover:opacity-80"
                  >
                    Deseleziona tutte
                  </button>
                {/if}
              </div>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  on:click={switchToDemoSession}
                  class="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors flex items-center gap-1"
                >
                  <span class="material-symbols-outlined text-[16px] text-secondary">school</span>
                  <span>Carica Dati Demo (28 studenti)</span>
                </button>
                <button
                  type="button"
                  on:click={openComparison}
                  class="px-4 py-2 rounded-xl bg-secondary text-on-secondary font-bold hover:bg-secondary/90 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span class="material-symbols-outlined text-[18px]">leaderboard</span>
                  <span>Apri Confronto Classi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Modale 2: Benchmark Comparativo tra Classi -->
      {#if showComparisonModal}
        <div class="fixed inset-0 z-50 bg-on-surface/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6" id="comparison-modal">
          <div class="bg-surface max-w-6xl w-full max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-outline-variant/30 text-on-surface">
            <!-- Header -->
            <div class="p-5 sm:p-6 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-secondary text-on-secondary flex items-center justify-center shadow-sm">
                  <span class="material-symbols-outlined text-[24px]">compare_arrows</span>
                </div>
                <div>
                  <h2 class="font-headline-sm text-headline-sm font-bold text-primary">Confronto Comparativo tra Classi</h2>
                  <p class="font-body-sm text-body-sm text-on-surface-variant">
                    Analisi incrociata dell'impatto ambientale LCA e dei cambi alimentari tra sessioni didattiche.
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  on:click={() => window.print()}
                  class="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Stampa report comparativo"
                >
                  <span class="material-symbols-outlined text-[18px]">print</span>
                  <span class="hidden sm:inline">Stampa Benchmark</span>
                </button>
                <button
                  type="button"
                  on:click={() => (showComparisonModal = false)}
                  class="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                >
                  <span class="material-symbols-outlined text-[24px]">close</span>
                </button>
              </div>
            </div>

            <!-- Content Scrollable Body -->
            <div class="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">
              
              <!-- Class selection chips -->
              <div class="flex items-center gap-2 flex-wrap bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/30">
                <span class="font-label-sm text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mr-1">
                  Classi nel confronto:
                </span>
                {#each sessionsForListing as s}
                  {@const isChecked = selectedSessionIdsForComparison.includes(s.session.id)}
                  <button
                    type="button"
                    on:click={() => toggleCompareSelection(s.session.id)}
                    class="px-3 py-1 rounded-lg font-label-sm text-label-sm font-semibold transition-all flex items-center gap-1.5 {isChecked ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}"
                  >
                    <span class="material-symbols-outlined text-[16px]">{isChecked ? 'check_box' : 'check_box_outline_blank'}</span>
                    <span>{s.session.code}</span>
                  </button>
                {/each}
              </div>

              {#if comparedSessionsList.length === 0}
                <div class="py-12 text-center text-on-surface-variant flex flex-col items-center justify-center p-8 rounded-xl bg-surface-container-low border border-dashed border-outline-variant">
                  <span class="material-symbols-outlined text-[48px] text-primary/40 mb-2">checklist</span>
                  <p class="font-headline-sm text-headline-sm font-bold text-primary">Nessuna classe selezionata</p>
                  <p class="font-body-md text-body-md mt-1">Seleziona almeno una classe tramite i pulsanti sopra per visualizzare l'analisi comparativa.</p>
                </div>
              {:else}
                <!-- Top Collective Highlights -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <!-- Card 1: Leader -->
                  <div class="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/20 flex flex-col justify-between">
                    <span class="font-label-sm text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Miglior Performance</span>
                    <div class="my-2">
                      <span class="font-headline-md text-headline-md font-extrabold text-secondary">
                        {leaderSession ? leaderSession.session.code : '-'}
                      </span>
                      <span class="font-label-md text-label-md text-secondary font-bold block">
                        -{leaderSession ? leaderSession.percentReduction : 0}% CO₂
                      </span>
                    </div>
                    <span class="font-label-sm text-label-sm text-on-surface-variant">Maggior taglio relativo dei consumi</span>
                  </div>

                  <!-- Card 2: Totale CO2 -->
                  <div class="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/20 flex flex-col justify-between">
                    <span class="font-label-sm text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">CO₂ Totale Evitata</span>
                    <div class="my-2">
                      <span class="font-metric-display text-metric-display text-primary font-bold">
                        {totalComparisonKgSaved}
                      </span>
                      <span class="text-title-md text-on-surface-variant font-semibold ml-1">kg CO₂e</span>
                    </div>
                    <span class="font-label-sm text-label-sm text-on-surface-variant">Cumulativo di tutte le classi a confronto</span>
                  </div>

                  <!-- Card 3: Km Auto -->
                  <div class="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/20 flex flex-col justify-between">
                    <span class="font-label-sm text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Tratta Auto Diesel Evitata</span>
                    <div class="my-2">
                      <span class="font-metric-display text-metric-display text-secondary font-bold">
                        {totalComparisonKmSaved}
                      </span>
                      <span class="text-title-md text-on-surface-variant font-semibold ml-1">km</span>
                    </div>
                    <span class="font-label-sm text-label-sm text-on-surface-variant">Calcolato su 130g CO₂/km</span>
                  </div>

                  <!-- Card 4: Studenti -->
                  <div class="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/20 flex flex-col justify-between">
                    <span class="font-label-sm text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Studenti Coinvolti</span>
                    <div class="my-2">
                      <span class="font-metric-display text-metric-display text-on-surface font-bold">
                        {totalComparisonStudents}
                      </span>
                      <span class="text-title-md text-on-surface-variant font-semibold ml-1">alunni</span>
                    </div>
                    <span class="font-label-sm text-label-sm text-on-surface-variant">Campione didattico attivo</span>
                  </div>
                </div>

                <!-- Side-by-Side Graphic Cards -->
                <div>
                  <h3 class="font-headline-sm text-headline-sm font-bold text-primary mb-3">
                    Confronto Grafico Diretto delle Classi
                  </h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {#each comparedSessionsList as cStat}
                      <div class="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden">
                        {#if cStat.session.id === session.id}
                          <div class="absolute top-0 right-0 bg-secondary text-on-secondary px-3 py-0.5 rounded-bl-lg font-label-sm text-label-sm font-bold">
                            IN SCHERMO
                          </div>
                        {/if}

                        <div>
                          <div class="flex items-baseline justify-between mb-2">
                            <span class="font-mono text-2xl font-black text-primary tracking-wider">{cStat.session.code}</span>
                            <span class="font-label-sm text-label-sm text-on-surface-variant">{formatDate(cStat.session.created_at)}</span>
                          </div>

                          <div class="flex items-center gap-2 mb-4 font-label-sm text-label-sm text-on-surface-variant">
                            <span class="font-bold text-on-surface">{cStat.participantCount} studenti</span>
                            <span>•</span>
                            <span>{cStat.completedCount} prove complete</span>
                          </div>

                          <!-- Visual Bars -->
                          <div class="flex flex-col gap-3 my-3 bg-surface-container-low p-3.5 rounded-xl">
                            <!-- Bar 1: Cieca -->
                            <div>
                              <div class="flex justify-between items-baseline mb-1">
                                <span class="font-label-sm text-label-sm font-semibold flex items-center gap-1.5 text-error">
                                  <span class="w-2 h-2 rounded-full bg-error"></span>
                                  Fase 1 (Cieca)
                                </span>
                                <span class="font-title-md text-title-md font-bold text-error">
                                  {cStat.avgCo2Bowl1 > 0 ? `${cStat.avgCo2Bowl1} g` : 'N/D'}
                                </span>
                              </div>
                              <div class="w-full bg-surface-container h-6 rounded-lg overflow-hidden flex items-center">
                                <div
                                  class="bg-error/85 h-full rounded-lg transition-all duration-700"
                                  style="width: {cStat.avgCo2Bowl1 > 0 ? Math.min(100, Math.round((cStat.avgCo2Bowl1 / 3500) * 100)) : 0}%;"
                                ></div>
                              </div>
                            </div>

                            <!-- Bar 2: Consapevole -->
                            <div>
                              <div class="flex justify-between items-baseline mb-1">
                                <span class="font-label-sm text-label-sm font-semibold flex items-center gap-1.5 text-secondary">
                                  <span class="w-2 h-2 rounded-full bg-secondary"></span>
                                  Fase 2 (Consapevole)
                                </span>
                                <span class="font-title-md text-title-md font-bold text-secondary">
                                  {cStat.avgCo2Bowl2 > 0 ? `${cStat.avgCo2Bowl2} g` : 'N/D'}
                                </span>
                              </div>
                              <div class="w-full bg-surface-container h-6 rounded-lg overflow-hidden flex items-center">
                                <div
                                  class="bg-secondary h-full rounded-lg transition-all duration-700"
                                  style="width: {cStat.avgCo2Bowl2 > 0 ? Math.min(100, Math.round((cStat.avgCo2Bowl2 / 3500) * 100)) : 0}%;"
                                ></div>
                              </div>
                            </div>

                            <!-- Reference Target line -->
                            <div class="flex items-center justify-between pt-1 border-t border-outline-variant/30 text-[11px] text-on-surface-variant font-medium">
                              <span>Target Planetario EAT-Lancet</span>
                              <span class="font-bold text-primary">≤ 600 g CO₂e</span>
                            </div>
                          </div>

                          <!-- Metrics list -->
                          <div class="flex flex-col gap-2 font-label-md text-label-md pt-2 border-t border-outline-variant/20">
                            <div class="flex justify-between items-center">
                              <span class="text-on-surface-variant">Riduzione media CO₂:</span>
                              {#if cStat.completedCount > 0}
                                <span class="font-bold text-secondary text-title-md">
                                  -{cStat.percentReduction}%
                                </span>
                              {:else}
                                <span class="font-semibold text-on-surface-variant text-label-sm">
                                  In attesa di Fase 2
                                </span>
                              {/if}
                            </div>
                            <div class="flex justify-between items-center">
                              <span class="text-on-surface-variant">Studenti in Target EAT:</span>
                              <span class="font-bold text-primary">
                                {cStat.eatLancetPassPercent}% ({cStat.eatLancetPassCount})
                              </span>
                            </div>
                            <div class="flex justify-between items-center">
                              <span class="text-on-surface-variant">Transizione Proteica:</span>
                              <span class="font-semibold text-on-surface truncate max-w-[160px]" title="{getIngredient(cStat.topProteinFase1)?.label || 'Non disp.'} -> {getIngredient(cStat.topProteinFase2)?.label || 'Non disp.'}">
                                {getIngredient(cStat.topProteinFase1)?.label || '-'} ➔ {getIngredient(cStat.topProteinFase2)?.label || '-'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <!-- Card button -->
                        <div class="mt-4 pt-3 border-t border-outline-variant/20 flex justify-end">
                          {#if cStat.session.id !== session.id}
                            <button
                              type="button"
                              on:click={() => selectSession(cStat.session)}
                              class="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-1 shadow-sm"
                            >
                              <span class="material-symbols-outlined text-[16px] text-secondary-fixed">play_circle</span>
                              <span>Attiva sulla LIM</span>
                            </button>
                          {:else}
                            <span class="text-secondary font-label-sm text-label-sm font-bold flex items-center gap-1">
                              <span class="material-symbols-outlined text-[16px]">visibility</span>
                              Attualmente Proiettata
                            </span>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>

                <!-- Comprehensive Comparison Table -->
                <div class="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30 overflow-x-auto">
                  <h3 class="font-headline-sm text-headline-sm font-bold text-primary mb-3">
                    Tabella Dati di Benchmark
                  </h3>
                  <table class="w-full text-left font-label-md text-label-md">
                    <thead>
                      <tr class="border-b border-outline-variant/40 text-on-surface-variant font-bold uppercase text-[11px] tracking-wider">
                        <th class="pb-3 pr-4">Classe (PIN)</th>
                        <th class="pb-3 px-4">Data</th>
                        <th class="pb-3 px-4 text-center">Partecipanti</th>
                        <th class="pb-3 px-4 text-right">Media Fase 1</th>
                        <th class="pb-3 px-4 text-right">Media Fase 2</th>
                        <th class="pb-3 px-4 text-right">Risparmio Netto</th>
                        <th class="pb-3 px-4 text-right">% Riduzione</th>
                        <th class="pb-3 px-4 text-center">In Target EAT</th>
                        <th class="pb-3 pl-4 text-right">Azione</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-outline-variant/20">
                      {#each comparedSessionsList as row}
                        <tr class="hover:bg-surface-container-low/60 transition-colors">
                          <td class="py-3.5 pr-4 font-mono font-bold text-primary text-base">
                            {row.session.code}
                          </td>
                          <td class="py-3.5 px-4 text-on-surface-variant font-body-sm">
                            {formatDate(row.session.created_at)}
                          </td>
                          <td class="py-3.5 px-4 text-center font-bold">
                            {row.participantCount}
                          </td>
                          <td class="py-3.5 px-4 text-right font-medium text-error">
                            {row.avgCo2Bowl1 > 0 ? `${row.avgCo2Bowl1} g` : '-'}
                          </td>
                          <td class="py-3.5 px-4 text-right font-bold text-secondary">
                            {row.avgCo2Bowl2 > 0 ? `${row.avgCo2Bowl2} g` : '-'}
                          </td>
                          <td class="py-3.5 px-4 text-right font-semibold text-primary">
                            {row.avgCo2Saved > 0 ? `-${row.avgCo2Saved} g` : '-'}
                          </td>
                          <td class="py-3.5 px-4 text-right">
                            <span class="px-2 py-0.5 rounded font-bold {row.percentReduction > 60 ? 'bg-secondary text-on-secondary' : 'bg-surface-container text-on-surface'}">
                              {row.percentReduction > 0 ? `-${row.percentReduction}%` : '-'}
                            </span>
                          </td>
                          <td class="py-3.5 px-4 text-center font-bold text-primary">
                            {row.eatLancetPassPercent}%
                          </td>
                          <td class="py-3.5 pl-4 text-right">
                            <button
                              type="button"
                              on:click={() => selectSession(row.session)}
                              class="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-label-sm font-semibold transition-colors"
                            >
                              Carica
                            </button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>

              {/if}

            </div>

            <!-- Footer -->
            <div class="p-4 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between">
              <button
                type="button"
                on:click={() => (showComparisonModal = false)}
                class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
              >
                Chiudi
              </button>
              <button
                type="button"
                on:click={openSessionsManager}
                class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span class="material-symbols-outlined text-[18px] text-secondary-fixed">folder_shared</span>
                <span>Torna a Gestione Sessioni</span>
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Modale 3: Conferma Eliminazione Sessione -->
      {#if sessionToDelete}
        <div class="fixed inset-0 z-50 bg-on-surface/80 backdrop-blur-md flex items-center justify-center p-4">
          <div class="bg-surface max-w-md w-full rounded-2xl p-6 shadow-2xl border border-outline-variant/30 text-on-surface flex flex-col gap-4">
            <div class="w-12 h-12 rounded-xl bg-error/10 text-error flex items-center justify-center">
              <span class="material-symbols-outlined text-[28px]">delete_forever</span>
            </div>
            <div>
              <h3 class="font-headline-sm text-headline-sm font-bold text-primary">Elimina sessione {sessionToDelete.code}?</h3>
              <p class="font-body-md text-body-md text-on-surface-variant mt-1">
                Questa azione eliminerà permanentemente la classe <strong>{sessionToDelete.code}</strong> e tutte le bowl e partecipanti associati dal database.
              </p>
            </div>
            <div class="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                on:click={() => (sessionToDelete = null)}
                class="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                on:click={handleConfirmDelete}
                class="px-4 py-2 rounded-xl bg-error text-on-error font-label-md text-label-md font-bold hover:bg-error/90 transition-colors shadow-sm"
              >
                Elimina definitivamente
              </button>
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
