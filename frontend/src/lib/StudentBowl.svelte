<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte'
  import type { Bowl, Participant, Session } from './types'
  import { BASES, EXTRAS, PROTEINS, computeCo2, getIngredient } from './ingredients'
  import { fetchParticipantBowls, fetchSession, saveBowl } from './api'

  export let session: Session
  export let participant: Participant
  export let initialWaiting = false

  const dispatch = createEventDispatcher<{ exit: void }>()
  const DIESEL_CO2_PER_KM = 130

  let liveSession: Session = session
  let pollHandle: number | null = null

  // Selection state - start with NO pre-selected items
  let size: Bowl['size'] = 'regular'
  let baseId = ''
  let selectedProteins: string[] = []
  let selectedExtras: string[] = []
  let dressingId = ''

  let isSaving = false
  let errorMessage = ''
  let summary: Awaited<ReturnType<typeof fetchParticipantBowls>> | null = null
  let copiedId = false
  let activeTab: 'componi' | 'impronta' | 'classifica' | 'guida' = 'componi'
  let breakdownCat: 'protein' | 'base' | 'extra' = 'protein'
  let showTipsModal = false
  let isWaitingPhase1 = initialWaiting
  let hasEditedPhase1 = false
  let isInitialLoaded = false
  let lastKnownPhase = session.phase

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

  if (initialWaiting && !summary && session.id === 'demo-session') {
    summary = {
      participantNumber: 17,
      bowl1: {
        id: 'demo-b1',
        session_id: session.id,
        participant_id: participant.id,
        phase: 1,
        size: 'regular',
        base_id: 'riso_bianco',
        protein_ids: ['salmone'],
        ingredient_ids: ['avocado', 'pomodorini'],
        total_co2_g: 2626,
        total_km: 20.2,
        created_at: new Date().toISOString()
      }
    }
  }

  async function refreshSession() {
    if (session.id === 'demo-session') return
    try {
      const updatedSession = await fetchSession(session.id)
      const updatedSummary = await fetchParticipantBowls(session.id, participant.id)

      // Detect phase transition from 1 -> 2
      if (lastKnownPhase === 1 && updatedSession.phase === 2) {
        isWaitingPhase1 = false
        // Starting Phase 2 fresh with no pre-selections
        if (!updatedSummary?.bowl2) {
          baseId = ''
          selectedProteins = []
          selectedExtras = []
        }
        await tick()
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
        }
      } else if (lastKnownPhase === 2 && updatedSession.phase === 3) {
        await tick()
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
        }
      }
      lastKnownPhase = updatedSession.phase
      liveSession = updatedSession
      summary = updatedSummary

      if (summary?.participantNumber && participant.number !== summary.participantNumber) {
        participant = { ...participant, number: summary.participantNumber }
      }

      // First load only (on mount / page refresh)
      if (!isInitialLoaded) {
        isInitialLoaded = true
        if (liveSession.phase === 1) {
          if (summary?.bowl1) {
            isWaitingPhase1 = true
            baseId = summary.bowl1.base_id || ''
            selectedProteins = summary.bowl1.protein_ids ? [...summary.bowl1.protein_ids] : []
            selectedExtras = summary.bowl1.ingredient_ids ? [...summary.bowl1.ingredient_ids] : []
            if (summary.bowl1.size) size = summary.bowl1.size
          }
        } else if (liveSession.phase === 2) {
          if (summary?.bowl2) {
            baseId = summary.bowl2.base_id || ''
            selectedProteins = summary.bowl2.protein_ids ? [...summary.bowl2.protein_ids] : []
            selectedExtras = summary.bowl2.ingredient_ids ? [...summary.bowl2.ingredient_ids] : []
            if (summary.bowl2.size) size = summary.bowl2.size
          } else {
            // Fresh Phase 2: ensure empty
            baseId = ''
            selectedProteins = []
            selectedExtras = []
          }
        }
      } else {
        // Subsequent recurring polls: NEVER overwrite user form selections!
        if (liveSession.phase === 1 && summary?.bowl1 && !hasEditedPhase1) {
          isWaitingPhase1 = true
        }
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
    errorMessage = ''
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
    errorMessage = ''
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

      if (liveSession.phase === 1) {
        isWaitingPhase1 = true
        hasEditedPhase1 = false
        await tick()
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
          setTimeout(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
          }, 50)
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
  $: currentProteinObjs = selectedProteins.map((id) => getIngredient(id)).filter(Boolean) as (typeof PROTEINS)[number][]
  $: currentExtraObjs = selectedExtras.map((id) => getIngredient(id)).filter(Boolean) as (typeof EXTRAS)[number][]

  $: hasSelections = Boolean(baseId || selectedProteins.length > 0 || selectedExtras.length > 0)

  function getBaseTheme(id: string) {
    switch (id) {
      case 'riso_nero':
        return {
          gradient: 'from-[#2e2638] via-[#1f1926] to-[#120e18]',
          border: 'border-purple-900/50',
          text: 'text-purple-100',
          chipBg: 'bg-black/60',
          pattern: '#a855f7'
        }
      case 'riso_integrale':
        return {
          gradient: 'from-[#d9caa7] via-[#c4b087] to-[#a89269]',
          border: 'border-[#bfa97e]',
          text: 'text-amber-950',
          chipBg: 'bg-amber-100/90',
          pattern: '#78350f'
        }
      case 'patate':
        return {
          gradient: 'from-[#fef08a] via-[#fde047] to-[#eab308]',
          border: 'border-yellow-400',
          text: 'text-amber-950',
          chipBg: 'bg-yellow-50/90',
          pattern: '#ca8a04'
        }
      case 'noodles':
        return {
          gradient: 'from-[#fef9c3] via-[#fef08a] to-[#facc15]',
          border: 'border-amber-300',
          text: 'text-amber-950',
          chipBg: 'bg-amber-50/90',
          pattern: '#d97706'
        }
      case 'riso_bianco':
      default:
        return {
          gradient: 'from-[#ffffff] via-[#f1f5f9] to-[#cbd5e1]',
          border: 'border-white/80',
          text: 'text-emerald-950',
          chipBg: 'bg-white/90',
          pattern: '#94a3b8'
        }
    }
  }

  interface VisualTopping {
    id: string
    icon: string
    label: string
    type: 'protein' | 'extra'
    slotClass: string
    animClass: string
    bgClass: string
  }

  $: visualToppings = (() => {
    const pCount = currentProteinObjs.length
    const eCount = currentExtraObjs.length
    const items: VisualTopping[] = []
    const anims = ['animate-drop-1', 'animate-drop-2', 'animate-drop-3', 'animate-drop-4', 'animate-drop-1', 'animate-drop-2']

    const pBg = 'bg-white border-sky-200 shadow-md text-sky-950'
    const eBg = 'bg-white border-amber-200 shadow-md text-amber-950'

    if (pCount === 0) {
      if (eCount === 1) {
        items.push({ id: currentExtraObjs[0].id, icon: currentExtraObjs[0].icon ?? '🥗', label: currentExtraObjs[0].label, type: 'extra', slotClass: 'left-0 right-0 mx-auto top-[12px] w-[46px] h-[46px] text-[24px]', animClass: anims[0], bgClass: eBg })
      } else if (eCount === 2) {
        items.push({ id: currentExtraObjs[0].id, icon: currentExtraObjs[0].icon ?? '🥗', label: currentExtraObjs[0].label, type: 'extra', slotClass: 'left-[48px] top-[10px] w-[46px] h-[46px] text-[24px]', animClass: anims[0], bgClass: eBg })
        items.push({ id: currentExtraObjs[1].id, icon: currentExtraObjs[1].icon ?? '🥗', label: currentExtraObjs[1].label, type: 'extra', slotClass: 'right-[48px] top-[10px] w-[46px] h-[46px] text-[24px]', animClass: anims[1], bgClass: eBg })
      } else if (eCount >= 3) {
        items.push({ id: currentExtraObjs[0].id, icon: currentExtraObjs[0].icon ?? '🥗', label: currentExtraObjs[0].label, type: 'extra', slotClass: 'left-[46px] top-[6px] w-[46px] h-[46px] text-[24px]', animClass: anims[0], bgClass: eBg })
        items.push({ id: currentExtraObjs[1].id, icon: currentExtraObjs[1].icon ?? '🥗', label: currentExtraObjs[1].label, type: 'extra', slotClass: 'right-[46px] top-[6px] w-[46px] h-[46px] text-[24px]', animClass: anims[1], bgClass: eBg })
        items.push({ id: currentExtraObjs[2].id, icon: currentExtraObjs[2].icon ?? '🥗', label: currentExtraObjs[2].label, type: 'extra', slotClass: 'left-0 right-0 mx-auto top-[26px] w-[42px] h-[42px] text-[22px]', animClass: anims[2], bgClass: eBg })
        if (eCount >= 4) items.push({ id: currentExtraObjs[3].id, icon: currentExtraObjs[3].icon ?? '🥗', label: currentExtraObjs[3].label, type: 'extra', slotClass: 'left-[14px] top-[24px] w-[40px] h-[40px] text-[20px]', animClass: anims[3], bgClass: eBg })
        if (eCount >= 5) items.push({ id: currentExtraObjs[4].id, icon: currentExtraObjs[4].icon ?? '🥗', label: currentExtraObjs[4].label, type: 'extra', slotClass: 'right-[14px] top-[24px] w-[40px] h-[40px] text-[20px]', animClass: anims[4], bgClass: eBg })
      }
    } else if (pCount === 1) {
      if (eCount === 0) {
        items.push({ id: currentProteinObjs[0].id, icon: currentProteinObjs[0].icon ?? '🍗', label: currentProteinObjs[0].label, type: 'protein', slotClass: 'left-0 right-0 mx-auto top-[10px] w-[48px] h-[48px] text-[25px]', animClass: anims[0], bgClass: pBg })
      } else if (eCount === 1) {
        items.push({ id: currentProteinObjs[0].id, icon: currentProteinObjs[0].icon ?? '🍗', label: currentProteinObjs[0].label, type: 'protein', slotClass: 'left-[48px] top-[10px] w-[46px] h-[46px] text-[24px]', animClass: anims[0], bgClass: pBg })
        items.push({ id: currentExtraObjs[0].id, icon: currentExtraObjs[0].icon ?? '🥗', label: currentExtraObjs[0].label, type: 'extra', slotClass: 'right-[48px] top-[10px] w-[46px] h-[46px] text-[24px]', animClass: anims[1], bgClass: eBg })
      } else if (eCount === 2) {
        items.push({ id: currentProteinObjs[0].id, icon: currentProteinObjs[0].icon ?? '🍗', label: currentProteinObjs[0].label, type: 'protein', slotClass: 'left-[46px] top-[6px] w-[46px] h-[46px] text-[24px]', animClass: anims[0], bgClass: pBg })
        items.push({ id: currentExtraObjs[0].id, icon: currentExtraObjs[0].icon ?? '🥗', label: currentExtraObjs[0].label, type: 'extra', slotClass: 'right-[46px] top-[6px] w-[46px] h-[46px] text-[24px]', animClass: anims[1], bgClass: eBg })
        items.push({ id: currentExtraObjs[1].id, icon: currentExtraObjs[1].icon ?? '🥗', label: currentExtraObjs[1].label, type: 'extra', slotClass: 'left-0 right-0 mx-auto top-[26px] w-[42px] h-[42px] text-[22px]', animClass: anims[2], bgClass: eBg })
      } else if (eCount >= 3) {
        items.push({ id: currentProteinObjs[0].id, icon: currentProteinObjs[0].icon ?? '🍗', label: currentProteinObjs[0].label, type: 'protein', slotClass: 'left-[56px] top-[6px] w-[44px] h-[44px] text-[23px]', animClass: anims[0], bgClass: pBg })
        items.push({ id: currentExtraObjs[0].id, icon: currentExtraObjs[0].icon ?? '🥗', label: currentExtraObjs[0].label, type: 'extra', slotClass: 'right-[56px] top-[6px] w-[44px] h-[44px] text-[23px]', animClass: anims[1], bgClass: eBg })
        items.push({ id: currentExtraObjs[1].id, icon: currentExtraObjs[1].icon ?? '🥗', label: currentExtraObjs[1].label, type: 'extra', slotClass: 'left-[14px] top-[24px] w-[42px] h-[42px] text-[22px]', animClass: anims[2], bgClass: eBg })
        items.push({ id: currentExtraObjs[2].id, icon: currentExtraObjs[2].icon ?? '🥗', label: currentExtraObjs[2].label, type: 'extra', slotClass: 'right-[14px] top-[24px] w-[42px] h-[42px] text-[22px]', animClass: anims[3], bgClass: eBg })
        if (eCount >= 4) items.push({ id: currentExtraObjs[3].id, icon: currentExtraObjs[3].icon ?? '🥗', label: currentExtraObjs[3].label, type: 'extra', slotClass: 'left-0 right-0 mx-auto top-[28px] w-[40px] h-[40px] text-[20px]', animClass: anims[4], bgClass: eBg })
      }
    } else {
      // 2 Proteins (Large)
      items.push({ id: currentProteinObjs[0].id, icon: currentProteinObjs[0].icon ?? '🍗', label: currentProteinObjs[0].label, type: 'protein', slotClass: 'left-[56px] top-[6px] w-[46px] h-[46px] text-[24px]', animClass: anims[0], bgClass: pBg })
      items.push({ id: currentProteinObjs[1].id, icon: currentProteinObjs[1].icon ?? '🍗', label: currentProteinObjs[1].label, type: 'protein', slotClass: 'right-[56px] top-[6px] w-[46px] h-[46px] text-[24px]', animClass: anims[1], bgClass: pBg })

      if (eCount === 1) {
        items.push({ id: currentExtraObjs[0].id, icon: currentExtraObjs[0].icon ?? '🥗', label: currentExtraObjs[0].label, type: 'extra', slotClass: 'left-0 right-0 mx-auto top-[26px] w-[44px] h-[44px] text-[23px]', animClass: anims[2], bgClass: eBg })
      } else if (eCount === 2) {
        items.push({ id: currentExtraObjs[0].id, icon: currentExtraObjs[0].icon ?? '🥗', label: currentExtraObjs[0].label, type: 'extra', slotClass: 'left-[14px] top-[24px] w-[42px] h-[42px] text-[22px]', animClass: anims[2], bgClass: eBg })
        items.push({ id: currentExtraObjs[1].id, icon: currentExtraObjs[1].icon ?? '🥗', label: currentExtraObjs[1].label, type: 'extra', slotClass: 'right-[14px] top-[24px] w-[42px] h-[42px] text-[22px]', animClass: anims[3], bgClass: eBg })
      } else if (eCount >= 3) {
        items.push({ id: currentExtraObjs[0].id, icon: currentExtraObjs[0].icon ?? '🥗', label: currentExtraObjs[0].label, type: 'extra', slotClass: 'left-[14px] top-[24px] w-[42px] h-[42px] text-[22px]', animClass: anims[2], bgClass: eBg })
        items.push({ id: currentExtraObjs[1].id, icon: currentExtraObjs[1].icon ?? '🥗', label: currentExtraObjs[1].label, type: 'extra', slotClass: 'right-[14px] top-[24px] w-[42px] h-[42px] text-[22px]', animClass: anims[3], bgClass: eBg })
        items.push({ id: currentExtraObjs[2].id, icon: currentExtraObjs[2].icon ?? '🥗', label: currentExtraObjs[2].label, type: 'extra', slotClass: 'left-0 right-0 mx-auto top-[28px] w-[40px] h-[40px] text-[20px]', animClass: anims[4], bgClass: eBg })
      }
    }

    return items
  })()

  $: overflowExtrasCount = Math.max(0, currentExtraObjs.length - visualToppings.filter((t) => t.type === 'extra').length)

  // Display items for waiting screen (fall back to summary.bowl1 if form is cleared)
  $: displayBase = currentBase ?? (summary?.bowl1?.base_id ? getIngredient(summary.bowl1.base_id) : undefined)
  $: displayProteins = currentProteinObjs.length > 0
    ? currentProteinObjs
    : (summary?.bowl1?.protein_ids?.map((id) => getIngredient(id)).filter(Boolean) as (typeof PROTEINS)[number][] ?? [])
  $: displayExtras = currentExtraObjs.length > 0
    ? currentExtraObjs
    : (summary?.bowl1?.ingredient_ids?.map((id) => getIngredient(id)).filter(Boolean) as (typeof EXTRAS)[number][] ?? [])

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
      {#if isWaitingPhase1}
        <!-- SCHERMATA DI ATTESA FASE 1 CON RIEPILOGO E TASTO MODIFICA -->
        <div class="flex flex-col gap-space-md pt-space-md pb-12">
          
          <!-- Stepper Indicator -->
          <div class="flex flex-col gap-space-xs bg-surface-container-low p-space-md rounded-xl shadow-sm">
            <div class="flex items-center justify-between">
              <span class="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                Fase 1 di 3 · Blind Challenge
              </span>
              <span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                In attesa
              </span>
            </div>
            <div class="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden flex mt-1">
              <div class="h-full bg-secondary rounded-full transition-all duration-500 w-1/3"></div>
            </div>
          </div>

          <!-- Hero Waiting Card -->
          <div class="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-space-lg shadow-md border border-secondary-container/80 flex flex-col items-center text-center">
            <div class="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mb-space-sm shadow-sm relative">
              <span class="material-symbols-outlined text-[34px] text-secondary">hourglass_top</span>
              <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-secondary"></span>
              </span>
            </div>

            <span class="px-space-sm py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold uppercase tracking-wider mb-2">
              Scelta 1 Registrata
            </span>

            <h2 class="font-headline-sm text-headline-sm text-primary font-bold">
              In attesa della classe...
            </h2>

            <p class="font-body-sm text-body-sm text-on-surface-variant mt-2 max-w-sm leading-relaxed">
              La tua bowl istintiva è stata registrata con successo! Siamo in attesa che tutta la classe finisca di comporre la propria bowl e che il/la <strong>Docente</strong> dia il via alla <strong>Fase 2 (Scelta Consapevole)</strong> dalla LIM.
            </p>

            <div class="mt-space-md w-full p-space-sm rounded-xl bg-surface-container-low flex items-center justify-center gap-2 text-on-surface-variant font-label-sm text-label-sm">
              <span class="w-2.5 h-2.5 rounded-full bg-secondary animate-ping"></span>
              <span>Passaggio automatico alla Fase 2 appena avviata</span>
            </div>
          </div>

          <!-- Riepilogo Scelte (Scontrino Personale Fase 1) -->
          <div class="rounded-2xl bg-surface-container-lowest p-space-md shadow-md flex flex-col gap-space-sm">
            <div class="flex items-center justify-between border-b border-surface-container pb-space-xs">
              <div class="flex items-center gap-space-xs">
                <span class="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
                <span class="font-title-md text-title-md font-bold text-primary">Riepilogo delle tue scelte</span>
              </div>
              <span class="font-label-sm text-label-sm text-secondary font-semibold bg-secondary-container/50 px-2.5 py-0.5 rounded-full">
                {(summary?.bowl1?.size ?? size) === 'regular' ? 'Regular (1 Proteina)' : 'Large (2 Proteine)'}
              </span>
            </div>

            <!-- Dettaglio Ingredienti -->
            <div class="space-y-space-xs font-label-md text-label-md pt-1">
              <!-- Base -->
              <div class="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low">
                <div class="flex items-center gap-2.5">
                  <span class="text-[22px]">{displayBase?.icon ?? '🍚'}</span>
                  <div>
                    <p class="font-bold text-on-surface leading-none">{displayBase?.label ?? 'Base selezionata'}</p>
                    <p class="font-label-sm text-label-sm text-on-surface-variant mt-0.5">Base della bowl</p>
                  </div>
                </div>
                <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">{displayBase?.portion ?? '150g'}</span>
              </div>

              <!-- Proteine -->
              {#each displayProteins as prot}
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low">
                  <div class="flex items-center gap-2.5">
                    <span class="text-[22px]">{prot?.icon ?? '🍗'}</span>
                    <div>
                      <p class="font-bold text-on-surface leading-none">{prot?.label ?? 'Proteina'}</p>
                      <p class="font-label-sm text-label-sm text-on-surface-variant mt-0.5">Fonte proteica</p>
                    </div>
                  </div>
                  <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">{prot?.portion ?? '80g'}</span>
                </div>
              {/each}

              <!-- Extra -->
              {#if displayExtras.length > 0}
                <div class="p-2.5 rounded-xl bg-surface-container-low flex flex-col gap-1.5">
                  <span class="font-label-sm text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                    Ingredienti Extra ({displayExtras.length}):
                  </span>
                  <div class="flex flex-wrap gap-1.5">
                    {#each displayExtras as extra}
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm">
                        <span>{extra?.icon ?? '🥗'}</span>
                        <span class="font-medium">{extra?.label}</span>
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>

            <!-- Avviso Didattico Blind -->
            <div class="p-space-sm rounded-xl bg-surface-container-low flex items-start gap-space-xs text-on-surface-variant font-body-sm text-body-sm mt-1">
              <span class="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">lock</span>
              <span>L'impronta di carbonio di questa ricetta è ancora segreta: verrà rivelata all'inizio della Fase 2 per confrontarla con la soglia di sostenibilità planetaria!</span>
            </div>
          </div>

          <!-- Tasto Modifica Scelte -->
          <div class="pt-space-xs flex flex-col gap-space-xs">
            <button
              type="button"
              on:click={async () => {
                isWaitingPhase1 = false
                hasEditedPhase1 = true
                if (summary?.bowl1 && !baseId) {
                  baseId = summary.bowl1.base_id || ''
                  selectedProteins = summary.bowl1.protein_ids ? [...summary.bowl1.protein_ids] : []
                  selectedExtras = summary.bowl1.ingredient_ids ? [...summary.bowl1.ingredient_ids] : []
                  if (summary.bowl1.size) size = summary.bowl1.size
                }
                await tick()
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
                }
              }}
              class="w-full h-14 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high border-2 border-primary/20 text-primary font-title-md text-title-md font-bold flex items-center justify-center gap-space-sm shadow-sm transition-all active:scale-[0.99]"
            >
              <span class="material-symbols-outlined text-[20px]">edit</span>
              <span>Torna indietro e modifica le scelte</span>
            </button>
            <p class="text-center font-label-sm text-label-sm text-on-surface-variant opacity-80 mt-1">
              Puoi cambiare la tua ricetta finché il/la docente non avvia la Fase 2
            </p>
          </div>

        </div>
      {:else}
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
        <div class="relative bg-surface-container-lowest rounded-2xl p-space-md shadow-md overflow-hidden flex flex-col items-center justify-center min-h-[235px]">
          <div class="absolute -top-12 -right-12 w-36 h-36 bg-secondary-container/30 rounded-full blur-2xl pointer-events-none"></div>
          <div class="absolute -bottom-8 -left-8 w-32 h-32 bg-surface-container-high/40 rounded-full blur-xl pointer-events-none"></div>

          <!-- Stylized 3D Layered Bowl -->
          <div class="relative w-[260px] h-[160px] flex items-end justify-center">
            
            <!-- Layer 1: Back Cavity & Interior Shadow (z-0) -->
            <svg class="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 260 160" fill="none">
              <ellipse cx="130" cy="54" rx="106" ry="26" fill="#0c271f" />
              <ellipse cx="130" cy="55" rx="102" ry="23" fill="#143e32" />
              <ellipse cx="130" cy="56" rx="98" ry="20" fill="#1b4d3e" />
            </svg>

            <!-- Layer 2: Base Bed Layer inside cavity (z-10) -->
            {#if currentBase}
              {@const theme = getBaseTheme(currentBase.id)}
              <div class="absolute top-[40px] left-[32px] right-[32px] h-[40px] rounded-[50%] bg-gradient-to-b {theme.gradient} shadow-inner border {theme.border} flex items-center justify-center z-10 animate-base overflow-hidden">
                <div class="absolute inset-0 opacity-25 bg-[radial-gradient({theme.pattern}_1.5px,transparent_1.5px)] [background-size:6px_6px]"></div>
                {#if visualToppings.length === 0}
                  <span class="relative text-[11px] font-bold {theme.text} tracking-wide flex items-center gap-1 bg-white/95 px-3 py-0.5 rounded-full shadow-sm">
                    {currentBase.icon ?? '🍚'} {currentBase.label}
                  </span>
                {/if}
              </div>
            {/if}

            <!-- Layer 3: Empty State Orbs OR Active Ingredient Toppings (z-30) -->
            <div class="absolute inset-0 pointer-events-none z-30">
              {#if !currentBase && visualToppings.length === 0}
                <!-- Ghost floating items showing what's possible with gentle pulse -->
                <div class="absolute top-2 left-9 w-11 h-11 rounded-full bg-emerald-50/95 border-2 border-dashed border-emerald-300 flex items-center justify-center text-[22px] shadow-sm animate-ghost-1">
                  🍚
                </div>
                <div class="absolute -top-2 left-[108px] w-12 h-12 rounded-full bg-emerald-50/95 border-2 border-dashed border-emerald-400 flex items-center justify-center text-[26px] shadow-sm animate-ghost-2">
                  🐟
                </div>
                <div class="absolute top-2 right-9 w-11 h-11 rounded-full bg-emerald-50/95 border-2 border-dashed border-emerald-300 flex items-center justify-center text-[22px] shadow-sm animate-ghost-3">
                  🥑
                </div>
                <!-- Clean floating invitation badge -->
                <div class="absolute top-[46px] left-0 right-0 mx-auto w-max px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-emerald-950 border border-emerald-200 text-[11px] font-bold tracking-wide shadow-md flex items-center gap-1.5 animate-bounce whitespace-nowrap" style="animation-duration: 2.5s;">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Tocca gli ingredienti sotto</span>
                </div>
              {:else}
                <!-- Render animated toppings inside the bowl -->
                {#each visualToppings as topping (topping.id)}
                  <div
                    class="absolute {topping.slotClass} {topping.animClass} rounded-full {topping.bgClass} flex items-center justify-center border transition-transform"
                    title={topping.label}
                  >
                    <span>{topping.icon}</span>
                  </div>
                {/each}

                <!-- Overflow extras badge if > max slots -->
                {#if overflowExtrasCount > 0}
                  <div class="absolute -top-2 left-0 right-0 mx-auto w-max px-2.5 py-0.5 rounded-full bg-emerald-900 text-white text-[10px] font-bold shadow-md animate-drop-2 whitespace-nowrap">
                    +{overflowExtrasCount} {overflowExtrasCount === 1 ? 'altro extra' : 'altri extra'}
                  </div>
                {/if}
              {/if}
            </div>

            <!-- Layer 4: Front Ceramic Wall & Rim with Specular Gloss & Shadow (z-20) -->
            <svg class="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 260 160" fill="none">
              <!-- Table shadow -->
              <ellipse cx="130" cy="154" rx="74" ry="5.5" fill="#002117" fill-opacity="0.22" />
              <!-- Ceramic Body -->
              <path d="M 24 54 C 26 106, 76 150, 130 150 C 184 150, 234 106, 236 54 C 204 69, 56 69, 24 54 Z" fill="url(#bowlWallGradLive)" />
              <!-- Front Lip Highlight -->
              <path d="M 25 55 C 56 69, 204 69, 235 55" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" />
              <!-- Glaze Reflection -->
              <path d="M 48 84 C 70 125, 117 144, 130 144" stroke="rgba(255,255,255,0.16)" stroke-width="3" stroke-linecap="round" />
              <defs>
                <linearGradient id="bowlWallGradLive" x1="130" y1="54" x2="130" y2="150" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#245a4a" />
                  <stop offset="50%" stop-color="#1b4d3e" />
                  <stop offset="100%" stop-color="#0f3328" />
                </linearGradient>
              </defs>
            </svg>

          </div>

          <!-- Recipe Mini Summary Chips -->
          <div class="mt-space-sm w-full flex items-center justify-center gap-1.5 flex-wrap min-h-[28px]">
            {#if currentBase}
              <span class="px-space-sm py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                <span>{currentBase.label}</span>
              </span>
            {/if}
            {#each currentProteinObjs as prot}
              <span class="px-space-sm py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                <span>{prot.label}</span>
              </span>
            {/each}
            {#if selectedExtras.length > 0}
              <span class="px-space-sm py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                <span>{selectedExtras.length} Extra</span>
              </span>
            {/if}
            {#if !currentBase && currentProteinObjs.length === 0 && selectedExtras.length === 0}
              <span class="text-on-surface-variant/60 font-label-sm text-label-sm italic">
                Ciotola vuota
              </span>
            {/if}
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
            <span class="font-label-sm text-label-sm text-secondary font-semibold">{baseId ? '1 selezionata' : 'Nessuna base'}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            {#each BASES as base}
              <button
                type="button"
                on:click={() => { baseId = base.id; errorMessage = ''; }}
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
              {#if size === 'regular'}
                {selectedProteins.length ? '1 selezionata' : 'Scegli 1 ingrediente'}
              {:else}
                {selectedProteins.length ? `${selectedProteins.length}/2 selezionate` : 'Scegli 2 ingredienti'}
              {/if}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-space-sm">
            {#each PROTEINS as prot}
              {@const isSelected = selectedProteins.includes(prot.id)}
              <button
                type="button"
                on:click={() => { toggleProtein(prot.id); errorMessage = ''; }}
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
                on:click={() => { toggleExtra(ing.id); errorMessage = ''; }}
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
        <div class="mt-space-md pb-6 flex flex-col gap-space-xs">
          {#if errorMessage}
            <div class="p-space-sm rounded-xl bg-error-container text-on-error-container font-label-md text-label-md flex items-center gap-2 shadow-xs">
              <span class="material-symbols-outlined text-[20px] text-error">error</span>
              <span>{errorMessage}</span>
            </div>
          {/if}
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
      {/if}

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
          <div class="flex flex-col flex-1">
            <h3 class="font-title-md text-title-md text-on-secondary-container font-bold">Sfida Consapevole: Riprogetta la Bowl</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Ora prova a ricreare una nuova bowl che ti piaccia, ma con il minimo impatto climatico possibile! Tutti gli ingredienti ora mostrano il costo in CO₂ in tempo reale.
            </p>
            {#if summary?.bowl1}
              <button
                type="button"
                on:click={() => {
                  if (summary?.bowl1) {
                    baseId = summary.bowl1.base_id || ''
                    selectedProteins = summary.bowl1.protein_ids ? [...summary.bowl1.protein_ids] : []
                    selectedExtras = summary.bowl1.ingredient_ids ? [...summary.bowl1.ingredient_ids] : []
                    if (summary.bowl1.size) size = summary.bowl1.size
                    errorMessage = ''
                  }
                }}
                class="mt-2.5 text-xs font-semibold text-primary hover:underline flex items-center gap-1.5 bg-surface-container-lowest/80 px-2.5 py-1.5 rounded-lg w-max shadow-xs active:scale-95 transition-all"
              >
                <span class="material-symbols-outlined text-[16px] text-secondary">content_copy</span>
                <span>Copia ingredienti da Bowl 1</span>
              </button>
            {/if}
          </div>
        </div>

        <!-- 1. Basi con badge CO2 matching Stitch 02 -->
        <div class="flex flex-col gap-space-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-space-xs">
              <span class="w-6 h-6 rounded-full bg-primary-fixed flex items-center justify-center font-label-sm text-label-sm text-primary font-bold">1</span>
              <h4 class="font-title-md text-title-md text-on-surface font-semibold">Scegli la Base</h4>
            </div>
            <span class="font-label-sm text-label-sm text-secondary font-semibold uppercase">{baseId ? '1 scelta' : 'Nessuna'}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
            {#each BASES as base}
              {@const isSelected = baseId === base.id}
              {@const badge = getCo2BadgeClass(base.co2_g)}
              <button
                type="button"
                on:click={() => { baseId = base.id; errorMessage = ''; }}
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
            <span class="font-label-sm text-label-sm text-secondary font-semibold uppercase">{selectedProteins.length ? `${selectedProteins.length} scelta` : 'Nessuna'}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
            {#each PROTEINS as prot}
              {@const isSelected = selectedProteins.includes(prot.id)}
              {@const badge = getCo2BadgeClass(prot.co2_g)}
              <button
                type="button"
                on:click={() => { toggleProtein(prot.id); errorMessage = ''; }}
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
                on:click={() => { toggleExtra(ing.id); errorMessage = ''; }}
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
            {#if errorMessage}
              <div class="p-2 rounded-lg bg-error-container text-on-error-container font-label-sm text-label-sm flex items-center gap-1.5 mb-1 shadow-xs">
                <span class="material-symbols-outlined text-[16px] text-error">error</span>
                <span class="font-medium">{errorMessage}</span>
              </div>
            {/if}

            {#if hasSelections}
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-secondary-fixed text-[20px]">trending_down</span>
                  <span class="font-label-sm text-label-sm text-secondary-fixed uppercase font-bold tracking-wider">Risparmio vs Bowl 1</span>
                </div>
                <span class="px-space-xs py-0.5 rounded {deltaCo2 >= 0 ? 'bg-secondary text-on-secondary' : 'bg-error-container text-on-error-container'} font-label-sm text-label-sm font-extrabold tracking-tight">
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
                  {#if deltaCo2 >= 0}
                    <span class="material-symbols-outlined text-secondary-fixed text-[16px]">check</span>
                    <span class="font-label-sm text-label-sm text-secondary-fixed font-bold">
                      {kmSaved} km in auto evitati!
                    </span>
                  {:else}
                    <span class="material-symbols-outlined text-error-container text-[16px]">warning</span>
                    <span class="font-label-sm text-label-sm text-error-container font-bold">
                      Impatto superiore a Bowl 1
                    </span>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-secondary-fixed text-[20px]">eco</span>
                  <span class="font-label-sm text-label-sm text-secondary-fixed uppercase font-bold tracking-wider">Componi la nuova bowl</span>
                </div>
                <span class="px-space-xs py-0.5 rounded bg-surface-container-high/60 text-primary-fixed font-label-sm text-label-sm font-semibold">
                  Nessuna scelta
                </span>
              </div>

              <div class="flex items-center justify-between mt-0.5 text-primary-fixed-dim font-body-sm text-body-sm">
                <span>Seleziona base e proteine a basso impatto</span>
                <span class="font-label-sm text-label-sm font-bold text-secondary-fixed">Budget: &lt;600g</span>
              </div>
            {/if}

            <button
              type="button"
              on:click={handleSaveCurrentPhase}
              disabled={isSaving}
              class="w-full mt-space-xs py-2.5 px-space-md rounded-xl bg-secondary hover:bg-secondary-container hover:text-on-secondary-container text-on-secondary font-title-md text-title-md font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <span>{summary?.bowl2 ? 'Aggiorna Bowl Consapevole (Fase 2)' : 'Salva Bowl Consapevole (Fase 2)'}</span>
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

<style>
  @keyframes dropInBounce {
    0% {
      transform: translateY(-50px) scale(0.3);
      opacity: 0;
    }
    65% {
      transform: translateY(6px) scale(1.1);
      opacity: 1;
    }
    82% {
      transform: translateY(-2px) scale(0.96);
    }
    100% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  @keyframes floatBob1 {
    0% { transform: translateY(0px) rotate(-6deg); }
    100% { transform: translateY(-7px) rotate(-2deg); }
  }
  @keyframes floatBob2 {
    0% { transform: translateY(0px) rotate(6deg); }
    100% { transform: translateY(-8px) rotate(10deg); }
  }
  @keyframes floatBob3 {
    0% { transform: translateY(0px) rotate(-4deg); }
    100% { transform: translateY(-6px) rotate(-1deg); }
  }
  @keyframes floatBob4 {
    0% { transform: translateY(0px) rotate(4deg); }
    100% { transform: translateY(-7px) rotate(7deg); }
  }

  @keyframes ghostPulse {
    0%, 100% { opacity: 0.35; transform: translateY(0px) scale(0.94); }
    50% { opacity: 0.85; transform: translateY(-8px) scale(1.06); }
  }

  @keyframes basePop {
    0% { transform: scale(0.85); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  :global(.animate-drop-1) {
    animation: dropInBounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, floatBob1 3.2s ease-in-out 0.45s infinite alternate;
  }
  :global(.animate-drop-2) {
    animation: dropInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, floatBob2 3.6s ease-in-out 0.5s infinite alternate;
  }
  :global(.animate-drop-3) {
    animation: dropInBounce 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, floatBob3 3s ease-in-out 0.55s infinite alternate;
  }
  :global(.animate-drop-4) {
    animation: dropInBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, floatBob4 3.4s ease-in-out 0.6s infinite alternate;
  }

  :global(.animate-ghost-1) { animation: ghostPulse 2.6s ease-in-out infinite; }
  :global(.animate-ghost-2) { animation: ghostPulse 2.6s ease-in-out 0.5s infinite; }
  :global(.animate-ghost-3) { animation: ghostPulse 2.6s ease-in-out 1s infinite; }
  :global(.animate-base) { animation: basePop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
</style>
