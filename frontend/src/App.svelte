<script lang="ts">
  import { onMount } from 'svelte'
  import TeacherPanel from './lib/TeacherPanel.svelte'
  import StudentBowl from './lib/StudentBowl.svelte'
  import { getSessionByCode, createParticipant } from './lib/api'
  import type { Participant, Session } from './lib/types'

  type View = 'landing' | 'teacher' | 'student'

  let view: View = 'landing'
  let activeSession: Session | null = null
  let activeParticipant: Participant | null = null

  // Student joining state
  let studentCode = ''
  let studentJoinLoading = false
  let studentJoinError = ''

  // Teacher auth state
  const TEACHER_PIN = (import.meta.env.VITE_TEACHER_PIN as string | undefined) || '982341'
  let teacherPinInput = ''
  let teacherPinError = ''
  let teacherAuthenticated = false
  let showTeacherModal = false

  onMount(async () => {
    const params = new URLSearchParams(window.location.search)
    const codeParam = params.get('code')
    if (codeParam) {
      studentCode = codeParam.trim().toUpperCase().slice(0, 8)
      await handleStudentJoin()
    }
  })

  async function handleStudentJoin() {
    const cleanCode = studentCode.trim().toUpperCase()
    if (!cleanCode) {
      studentJoinError = 'Inserisci il codice fornito dal docente.'
      return
    }

    try {
      studentJoinLoading = true
      studentJoinError = ''
      const session = await getSessionByCode(cleanCode)
      if (!session) {
        studentJoinError = 'Sessione non trovata. Controlla il codice sulla LIM.'
        return
      }

      const participant = await createParticipant(session.id)
      activeSession = session
      activeParticipant = participant
      view = 'student'
    } catch (err) {
      console.error(err)
      studentJoinError = 'Impossibile connettersi alla sessione. Riprova.'
    } finally {
      studentJoinLoading = false
    }
  }

  function handleTeacherAccess() {
    if (!TEACHER_PIN) {
      teacherAuthenticated = true
      view = 'teacher'
      return
    }

    if (teacherPinInput.trim() === TEACHER_PIN) {
      teacherAuthenticated = true
      teacherPinError = ''
      showTeacherModal = false
      view = 'teacher'
    } else {
      teacherPinError = 'PIN non corretto. Inserisci il codice docente.'
    }
  }

  function exitToLanding() {
    view = 'landing'
    activeSession = null
    activeParticipant = null
  }
</script>

{#if view === 'landing'}
  <!-- Top Navigation Header -->
  <header class="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(27,77,62,0.06)]">
    <div class="h-20 w-full px-margin md:px-margin-desktop flex items-center justify-between gap-gutter">
      <div class="flex items-center gap-space-md">
        <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-secondary-fixed shadow-[0_2px_8px_-2px_rgba(27,77,62,0.12)]">
          <span class="material-symbols-outlined text-[24px]">nest_eco_leaf</span>
        </div>
        <div class="flex flex-col">
          <span class="font-headline-sm text-headline-sm text-primary tracking-tight">Crea la tua Bowl</span>
          <span class="font-label-sm text-label-sm text-on-surface-variant font-medium tracking-wide">UniSi Ecodynamics Group • Ricerca e Sostenibilità</span>
        </div>
      </div>

      <nav class="hidden lg:flex items-center gap-space-xs p-space-xs bg-surface-container-low rounded-xl">
        <button
          type="button"
          class="px-space-md py-space-sm bg-secondary-container text-on-secondary-container font-label-lg rounded-xl transition-colors"
        >
          Accesso e Ruoli
        </button>
        <button
          type="button"
          on:click={() => (showTeacherModal = true)}
          class="px-space-md py-space-sm rounded-xl font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
        >
          Docente Projector LIM
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
          <span class="font-label-sm text-label-sm text-on-surface-variant">Piattaforma Live</span>
        </div>
        <button
          type="button"
          on:click={() => (showTeacherModal = true)}
          title="Area Docente"
          class="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary hover:bg-primary-container transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">co_present</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Main Hero & Dual Role Cards -->
  <main class="w-full pt-24 pb-16 bg-background">
    <div class="w-full px-margin md:px-margin-desktop py-space-lg max-w-7xl mx-auto flex flex-col gap-space-xl">
      
      <!-- Hero Banner -->
      <div class="relative overflow-hidden rounded-2xl bg-surface-container-low p-space-lg md:p-space-xl shadow-sm">
        <div class="absolute -right-16 -top-16 w-96 h-96 rounded-full bg-secondary-container/40 blur-3xl pointer-events-none"></div>
        <div class="absolute right-1/3 -bottom-20 w-80 h-80 rounded-full bg-tertiary-fixed/30 blur-3xl pointer-events-none"></div>
        
        <div class="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-space-xl">
          <div class="flex flex-col max-w-2xl gap-space-md">
            <div class="inline-flex items-center gap-space-xs self-start px-space-md py-space-xs rounded-full bg-surface-container-lowest text-primary shadow-sm">
              <span class="material-symbols-outlined text-[16px] text-secondary">verified</span>
              <span class="font-label-sm text-label-sm uppercase tracking-wider font-bold">Progetto Didattico Università di Siena • Gruppo Ecodynamics</span>
            </div>
            
            <h1 class="font-display-lg text-display-lg text-primary tracking-tight">
              Crea la tua Bowl: <br class="hidden sm:inline"/>
              <span class="text-secondary font-extrabold">Il Gusto della Sostenibilità</span>
            </h1>
            
            <p class="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              Un serious game interattivo in 3 fasi per scoprire l'impronta carbonica reale dei tuoi cibi preferiti e sfidare la tua classe a ridurre l'impatto ecologico attraverso scelte alimentari consapevoli.
            </p>
            
            <div class="flex flex-wrap items-center gap-space-sm pt-space-xs">
              <span class="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-xl bg-surface-container-lowest text-on-surface shadow-sm font-label-md text-label-md">
                <span class="material-symbols-outlined text-secondary text-[18px]">query_stats</span>
                Metodologia Scientifica LCA
              </span>
              <span class="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-xl bg-surface-container-lowest text-on-surface shadow-sm font-label-md text-label-md">
                <span class="material-symbols-outlined text-secondary text-[18px]">visibility_off</span>
                100% Anonimo per gli Studenti
              </span>
              <span class="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-xl bg-surface-container-lowest text-on-surface shadow-sm font-label-md text-label-md">
                <span class="material-symbols-outlined text-secondary text-[18px]">co_present</span>
                Dashboard Docente per LIM / Proiettore
              </span>
            </div>
          </div>

          <!-- Culinary Visual Poke Bowl Card -->
          <div class="relative w-full lg:w-96 flex-shrink-0">
            <div class="relative rounded-2xl overflow-hidden shadow-xl bg-surface-container-lowest">
              <img
                class="w-full h-80 object-cover"
                alt="Culinary poke bowl composition"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDUG23A8JVdIpsfX8LYx8gNqtoci-2sBHJ-9UtnCpSEHCGUa_H_7w_2a_eWMBGKsoZ5DxAJPbgj_prviPDdlxUETHBa15lMq85cBKtug5OeClTKXHvKDx9E6p3BYgOWEmWFQkM86Tx1LNXVUfy6J9_2Wo0-3P66Df4OsN4c2hSI4LZ5HBLfQzyXZB39rHbYGwSMr3ujfHVcBNil61zu3sIrpRFQ5jhgaD3JzMwPK80fiKyIqhY9yOOIzA"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-primary/85 via-transparent to-transparent"></div>
              <div class="absolute top-4 left-4 inline-flex items-center gap-space-xs px-space-sm py-space-xs rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface shadow-sm font-label-sm text-label-sm">
                <span class="w-2 h-2 rounded-full bg-secondary"></span>
                LCA Certificata UniSi
              </div>
              <div class="absolute bottom-4 left-4 right-4 flex items-center justify-between text-on-primary">
                <div class="flex flex-col">
                  <span class="font-label-sm text-label-sm text-secondary-fixed">Ingrediente Virtuoso</span>
                  <span class="font-title-md text-title-md font-bold">Ceci Locali Toscani</span>
                </div>
                <div class="px-space-md py-space-xs rounded-xl bg-secondary text-on-secondary font-headline-sm text-headline-sm font-extrabold shadow-sm">
                  -96% CO₂e
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dual Role Selection Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-space-lg items-stretch">
        
        <!-- Student Card (Left) -->
        <div class="relative flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-space-lg md:p-space-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl">
          <div class="absolute top-0 left-0 right-0 h-2 bg-secondary"></div>
          <div class="flex flex-col gap-space-md">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-space-sm">
                <div class="w-12 h-12 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
                  <span class="material-symbols-outlined text-[28px]">smartphone</span>
                </div>
                <div class="flex flex-col">
                  <span class="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">Accesso Rapido Aula</span>
                  <h2 class="font-headline-md text-headline-md text-primary">Partecipa come Studente</h2>
                </div>
              </div>
              <div class="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[22px]">ramen_dining</span>
              </div>
            </div>

            <p class="font-body-md text-body-md text-on-surface-variant">
              Unisciti alla sessione interattiva digitando il codice a 5 lettere visualizzato sul proiettore o sulla LIM dal tuo insegnante.
            </p>

            <form on:submit|preventDefault={handleStudentJoin} class="mt-space-sm flex flex-col gap-space-sm">
              <label for="session-code-input" class="font-label-md text-label-md text-on-surface font-semibold">Codice Sessione della Classe</label>
              
              <div class="relative w-full">
                <input
                  id="session-code-input"
                  type="text"
                  bind:value={studentCode}
                  placeholder="ES. NMLHM"
                  maxlength="8"
                  class="w-full h-16 px-4 rounded-xl bg-surface-container-low text-center font-metric-display text-metric-display text-primary tracking-widest uppercase focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none shadow-sm transition-all"
                  autocomplete="off"
                  required
                />
              </div>

              {#if studentJoinError}
                <div class="p-space-sm rounded-xl bg-error-container text-on-error-container font-label-sm text-label-sm flex items-center gap-space-xs">
                  <span class="material-symbols-outlined text-[18px]">error</span>
                  <span>{studentJoinError}</span>
                </div>
              {/if}

              <div class="flex items-center gap-space-sm p-space-sm rounded-xl bg-surface-container-low">
                <span class="material-symbols-outlined text-secondary text-[20px]">shield_person</span>
                <span class="font-label-sm text-label-sm text-on-surface-variant">La tua identità rimarrà numerata e anonima per l'intero esperimento.</span>
              </div>

              <div class="mt-space-sm flex flex-col gap-space-md">
                <button
                  type="submit"
                  disabled={studentJoinLoading}
                  class="w-full h-14 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-md transition-all duration-200 hover:bg-primary-container active:scale-[0.99] disabled:opacity-60"
                >
                  {#if studentJoinLoading}
                    <span class="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                    <span>Connessione in corso…</span>
                  {:else}
                    <span>Entra nella Sessione</span>
                    <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                  {/if}
                </button>

                <div class="flex items-center justify-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm">
                  <span class="material-symbols-outlined text-[16px] text-secondary">qr_code_scanner</span>
                  <span>Hai lo smartphone? Puoi inquadrare direttamente il QR code sullo schermo LIM.</span>
                </div>
              </div>
            </form>
          </div>
        </div>

        <!-- Teacher Card (Right) -->
        <div class="relative flex flex-col justify-between rounded-2xl bg-surface-container-low p-space-lg md:p-space-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl">
          <div class="absolute top-0 left-0 right-0 h-2 bg-primary"></div>
          <div class="flex flex-col gap-space-md">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-space-sm">
                <div class="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center">
                  <span class="material-symbols-outlined text-[28px]">cast_for_education</span>
                </div>
                <div class="flex flex-col">
                  <span class="font-label-sm text-label-sm uppercase tracking-wider text-primary font-bold">Pannello Insegnante</span>
                  <h2 class="font-headline-md text-headline-md text-primary">Area Docente &amp; LIM</h2>
                </div>
              </div>
              <span class="material-symbols-outlined text-[24px] text-outline">lock</span>
            </div>

            <p class="font-body-md text-body-md text-on-surface-variant">
              Avvia una nuova sessione di classe, gestisci il ritmo delle tre fasi di simulazione e proietta la panoramica aggregata con istogrammi e impatto in tempo reale.
            </p>

            <form on:submit|preventDefault={handleTeacherAccess} class="mt-space-sm flex flex-col gap-space-sm">
              <label for="teacher-pin-input" class="font-label-md text-label-md text-on-surface font-semibold">PIN di Sicurezza Docente</label>
              
              <div class="relative w-full">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[20px]">pin</span>
                <input
                  id="teacher-pin-input"
                  type="password"
                  bind:value={teacherPinInput}
                  placeholder="Inserisci PIN docente"
                  class="w-full h-14 pl-12 pr-4 rounded-xl bg-surface-container-lowest text-primary font-headline-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  autocomplete="off"
                  required
                />
              </div>

              {#if teacherPinError}
                <div class="p-space-sm rounded-xl bg-error-container text-on-error-container font-label-sm text-label-sm flex items-center gap-space-xs">
                  <span class="material-symbols-outlined text-[18px]">error</span>
                  <span>{teacherPinError}</span>
                </div>
              {/if}

              <div class="flex items-center justify-between gap-space-xs p-space-sm rounded-xl bg-surface-container-lowest shadow-sm">
                <div class="flex items-center gap-space-xs">
                  <span class="material-symbols-outlined text-secondary text-[20px]">menu_book</span>
                  <span class="font-label-sm text-label-sm text-on-surface font-medium">Guida Metodologica Docente (LCA)</span>
                </div>
                <span class="font-label-sm text-label-sm text-secondary font-semibold">UniSi Edu</span>
              </div>

              <div class="mt-space-sm flex flex-col sm:flex-row items-center gap-space-sm">
                <button
                  type="submit"
                  class="w-full h-14 rounded-xl bg-secondary-container text-on-secondary-container font-headline-sm text-headline-sm flex items-center justify-center gap-space-xs shadow-sm transition-all duration-200 hover:bg-secondary-fixed active:scale-[0.99]"
                >
                  <span class="material-symbols-outlined text-[20px]">tv</span>
                  <span>Accedi alla Dashboard LIM</span>
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>

      <!-- Scientific Rigor & Agribalyse 3.1.1 Banner -->
      <div id="metodologia" class="rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md">
        <div class="flex items-center gap-space-md">
          <div class="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-primary flex-shrink-0">
            <span class="material-symbols-outlined text-[28px]">database</span>
          </div>
          <div class="flex flex-col">
            <span class="font-title-md text-title-md text-primary font-bold">Rigore Scientifico &amp; Banche Dati Internazionali</span>
            <p class="font-body-sm text-body-sm text-on-surface-variant">
              Tutti i coefficienti di emissione (gCO₂eq per porzione di ingrediente) sono tratti dai dataset standard Agribalyse 3.1.1 e rielaborati dal Dipartimento di Scienze Fisiche, della Terra e dell'Ambiente dell'Università di Siena per l'educazione alla sostenibilità.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-space-md flex-shrink-0">
          <div class="flex flex-col text-right">
            <span class="font-metric-display text-metric-display text-secondary">2.840+</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium tracking-wider">Bowl Studiate</span>
          </div>
        </div>
      </div>

    </div>
  </main>

  <!-- Global Footer -->
  <footer class="w-full bg-surface-container-low py-space-lg border-t border-surface-container">
    <div class="w-full px-margin md:px-margin-desktop flex flex-col md:flex-row items-center justify-between gap-space-md text-on-surface-variant max-w-7xl mx-auto">
      <div class="flex items-center gap-space-xs font-label-sm text-label-sm">
        <span class="material-symbols-outlined text-[16px] text-primary">science</span>
        <span>Progetto Scientifico a cura di Ecodynamics Group • Università degli Studi di Siena</span>
      </div>
      <div class="font-label-sm text-label-sm">
        © 2024-2026 Crea la tua Bowl. Indicatori ambientali calcolati secondo Life Cycle Assessment (LCA).
      </div>
    </div>
  </footer>

  <!-- Modal PIN Docente Quick Trigger -->
  {#if showTeacherModal}
    <div class="fixed inset-0 z-50 bg-on-surface/60 backdrop-blur-sm flex items-center justify-center p-space-md">
      <div class="bg-surface-container-lowest rounded-2xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md relative">
        <button
          type="button"
          on:click={() => (showTeacherModal = false)}
          class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-2 rounded-lg bg-surface-container-low"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div class="flex items-center gap-space-sm">
          <div class="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-[22px]">cast_for_education</span>
          </div>
          <div>
            <h3 class="font-title-md text-title-md font-bold text-primary">Accesso Area Docente</h3>
            <p class="font-label-sm text-label-sm text-on-surface-variant">Inserisci il PIN per gestire la LIM</p>
          </div>
        </div>

        <form on:submit|preventDefault={handleTeacherAccess} class="flex flex-col gap-space-sm">
          <input
            type="password"
            bind:value={teacherPinInput}
            placeholder="PIN docente"
            class="w-full h-12 px-4 rounded-xl bg-surface-container-low text-primary font-headline-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            autocomplete="off"
            required
          />

          {#if teacherPinError}
            <p class="text-error font-label-sm text-label-sm">{teacherPinError}</p>
          {/if}

          <div class="flex items-center justify-end gap-space-sm mt-space-xs">
            <button
              type="button"
              on:click={() => (showTeacherModal = false)}
              class="px-space-md py-space-sm rounded-xl text-on-surface-variant font-label-md text-label-md hover:bg-surface-container"
            >
              Annulla
            </button>
            <button
              type="submit"
              class="px-space-md py-space-sm rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold hover:bg-primary-container shadow-sm"
            >
              Entra
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

{:else if view === 'teacher'}
  <TeacherPanel on:exit={exitToLanding} />

{:else if view === 'student'}
  {#if activeSession && activeParticipant}
    <StudentBowl
      session={activeSession}
      participant={activeParticipant}
      on:exit={exitToLanding}
    />
  {/if}
{/if}
