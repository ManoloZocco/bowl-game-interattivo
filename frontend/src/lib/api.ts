import { supabase } from './supabaseClient'
import type { Bowl, BowlPhase, Participant, Session, SessionPhase } from './types'

function generateSessionCode(length = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export async function createSession(): Promise<Session> {
  const code = generateSessionCode()
  const { data, error } = await supabase
    .from('bowl_sessions')
    .insert({ code, phase: 1 })
    .select('*')
    .single()

  if (error || !data) {
    throw error ?? new Error('Impossibile creare la sessione')
  }

  return data as Session
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  const { data, error } = await supabase.from('bowl_sessions').select('*').eq('code', code.trim().toUpperCase()).maybeSingle()
  if (error) throw error
  return (data ?? null) as Session | null
}

export async function createParticipant(sessionId: string): Promise<Participant> {
  const { data, error } = await supabase.from('bowl_participants').insert({ session_id: sessionId }).select('*').single()
  if (error || !data) {
    throw error ?? new Error('Impossibile creare il partecipante')
  }
  return data as Participant
}

export async function updateSessionPhase(sessionId: string, phase: SessionPhase): Promise<void> {
  const { error } = await supabase.from('bowl_sessions').update({ phase }).eq('id', sessionId)
  if (error) throw error
}

export async function fetchSession(sessionId: string): Promise<Session> {
  const { data, error } = await supabase.from('bowl_sessions').select('*').eq('id', sessionId).single()
  if (error || !data) throw error ?? new Error('Sessione non trovata')
  return data as Session
}

export async function countParticipants(sessionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('bowl_participants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
  if (error) throw error
  return count ?? 0
}

export interface BowlInput {
  session_id: string
  participant_id: string
  phase: BowlPhase
  size: Bowl['size']
  base_id: string
  protein_ids: string[]
  ingredient_ids: string[]
  total_co2_g: number
  total_km: number
}

export async function saveBowl(input: BowlInput): Promise<Bowl> {
  const { data: existing } = await supabase
    .from('bowl_bowls')
    .select('id')
    .eq('session_id', input.session_id)
    .eq('participant_id', input.participant_id)
    .eq('phase', input.phase)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('bowl_bowls')
      .update(input)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error || !data) throw error ?? new Error('Impossibile aggiornare la bowl')
    return data as Bowl
  }

  const { data, error } = await supabase.from('bowl_bowls').insert(input).select('*').single()
  if (error || !data) {
    throw error ?? new Error('Impossibile salvare la bowl')
  }
  return data as Bowl
}

export interface ParticipantSummary {
  participantNumber: number | null
  bowl1?: Bowl
  bowl2?: Bowl
}

export async function fetchParticipantBowls(sessionId: string, participantId: string): Promise<ParticipantSummary> {
  const { data: participant, error: pErr } = await supabase
    .from('bowl_participants')
    .select('*')
    .eq('id', participantId)
    .single()
  if (pErr || !participant) throw pErr ?? new Error('Partecipante non trovato')

  const { data: bowls, error } = await supabase
    .from('bowl_bowls')
    .select('*')
    .eq('session_id', sessionId)
    .eq('participant_id', participantId)
    .order('phase', { ascending: true })

  if (error) throw error

  const bowl1 = bowls?.find((b) => b.phase === 1) as Bowl | undefined
  const bowl2 = bowls?.find((b) => b.phase === 2) as Bowl | undefined

  return {
    participantNumber: (participant as Participant).number,
    bowl1,
    bowl2
  }
}

export interface ClassSummaryRow {
  participantId?: string
  participantNumber: number | null
  bowl1?: Bowl
  bowl2?: Bowl
}

export async function finalizeSessionAndAssignNumbers(sessionId: string): Promise<void> {
  const { data: participants, error } = await supabase
    .from('bowl_participants')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!participants) return

  let index = 1
  // piccolo numero di studenti: aggiornamenti sequenziali vanno bene
  // eslint-disable-next-line no-restricted-syntax
  for (const p of participants as Participant[]) {
    // eslint-disable-next-line no-await-in-loop
    const { error: updErr } = await supabase
      .from('bowl_participants')
      .update({ number: index })
      .eq('id', p.id)
    if (updErr) throw updErr
    index += 1
  }

  await updateSessionPhase(sessionId, 3)
}

export async function fetchClassSummary(sessionId: string): Promise<ClassSummaryRow[]> {
  const { data: participants, error: pErr } = await supabase
    .from('bowl_participants')
    .select('*')
    .eq('session_id', sessionId)

  if (pErr) throw pErr

  const { data: bowls, error: bErr } = await supabase.from('bowl_bowls').select('*').eq('session_id', sessionId)
  if (bErr) throw bErr

  const byParticipant = new Map<string, { bowl1?: Bowl; bowl2?: Bowl }>()

  ;(bowls as Bowl[] | null)?.forEach((b) => {
    const current = byParticipant.get(b.participant_id) ?? {}
    if (b.phase === 1) current.bowl1 = b
    if (b.phase === 2) current.bowl2 = b
    byParticipant.set(b.participant_id, current)
  })

  return (participants as Participant[] | null)?.map((p) => {
    const pair = byParticipant.get(p.id) ?? {}
    return {
      participantId: p.id,
      participantNumber: p.number,
      bowl1: pair.bowl1,
      bowl2: pair.bowl2
    }
  }) ?? []
}

export async function fetchAllSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('bowl_sessions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Session[]
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('bowl_sessions').delete().eq('id', sessionId)
  if (error) throw error
}

export interface SessionStats {
  session: Session
  participantCount: number
  bowl1Count: number
  bowl2Count: number
  completedCount: number
  avgCo2Bowl1: number
  avgCo2Bowl2: number
  avgCo2Saved: number
  percentReduction: number
  totalKgSaved: number
  totalKmSaved: number
  eatLancetPassCount: number
  eatLancetPassPercent: number
  topProteinFase1: string | null
  topProteinFase2: string | null
}

export async function fetchSessionsWithStats(): Promise<SessionStats[]> {
  const [sessionsRes, participantsRes, bowlsRes] = await Promise.all([
    supabase.from('bowl_sessions').select('*').order('created_at', { ascending: false }),
    supabase.from('bowl_participants').select('id, session_id'),
    supabase.from('bowl_bowls').select('id, session_id, participant_id, phase, total_co2_g, protein_ids')
  ])

  if (sessionsRes.error) throw sessionsRes.error
  if (participantsRes.error) throw participantsRes.error
  if (bowlsRes.error) throw bowlsRes.error

  const sessions = (sessionsRes.data ?? []) as Session[]
  const participants = participantsRes.data ?? []
  const bowls = bowlsRes.data ?? []

  const participantsBySession = new Map<string, typeof participants>()
  for (const p of participants) {
    const list = participantsBySession.get(p.session_id) ?? []
    list.push(p)
    participantsBySession.set(p.session_id, list)
  }

  const bowlsBySession = new Map<string, typeof bowls>()
  for (const b of bowls) {
    const list = bowlsBySession.get(b.session_id) ?? []
    list.push(b)
    bowlsBySession.set(b.session_id, list)
  }

  const DIESEL_CO2_PER_KM = 130

  return sessions.map((sess) => {
    const sessParticipants = participantsBySession.get(sess.id) ?? []
    const sessBowls = bowlsBySession.get(sess.id) ?? []

    const participantCount = sessParticipants.length

    const bowlsByParticipant = new Map<string, { b1?: typeof sessBowls[0]; b2?: typeof sessBowls[0] }>()
    for (const b of sessBowls) {
      const entry = bowlsByParticipant.get(b.participant_id) ?? {}
      if (b.phase === 1) entry.b1 = b
      if (b.phase === 2) entry.b2 = b
      bowlsByParticipant.set(b.participant_id, entry)
    }

    let b1Count = 0
    let b2Count = 0
    let completedCount = 0
    let totalB1 = 0
    let totalB2 = 0
    let eatLancetCount = 0

    const proteinCount1: Record<string, number> = {}
    const proteinCount2: Record<string, number> = {}

    for (const [, pair] of bowlsByParticipant) {
      if (pair.b1) {
        b1Count++
        totalB1 += Number(pair.b1.total_co2_g) || 0
        for (const p of (pair.b1.protein_ids || [])) {
          proteinCount1[p] = (proteinCount1[p] || 0) + 1
        }
      }
      if (pair.b2) {
        b2Count++
        totalB2 += Number(pair.b2.total_co2_g) || 0
        if (Number(pair.b2.total_co2_g) <= 600) {
          eatLancetCount++
        }
        for (const p of (pair.b2.protein_ids || [])) {
          proteinCount2[p] = (proteinCount2[p] || 0) + 1
        }
      }
      if (pair.b1 && pair.b2) {
        completedCount++
      }
    }

    const avgB1 = b1Count > 0 ? Math.round(totalB1 / b1Count) : 0
    const avgB2 = b2Count > 0 ? Math.round(totalB2 / b2Count) : 0
    const avgSaved = b1Count > 0 && b2Count > 0 ? Math.max(0, avgB1 - avgB2) : 0
    const percentReduction = b1Count > 0 && b2Count > 0 && avgB1 > 0 ? Math.round((avgSaved / avgB1) * 100) : 0

    const getTopProtein = (counts: Record<string, number>): string | null => {
      let maxKey: string | null = null
      let maxVal = 0
      for (const [key, val] of Object.entries(counts)) {
        if (val > maxVal) {
          maxVal = val
          maxKey = key
        }
      }
      return maxKey
    }

    const totalCo2SavedG = completedCount > 0 ? Math.max(0, totalB1 - totalB2) : 0
    const totalKgSaved = Number((totalCo2SavedG / 1000).toFixed(1))
    const totalKmSaved = Number((totalCo2SavedG / DIESEL_CO2_PER_KM).toFixed(1))

    return {
      session: sess,
      participantCount,
      bowl1Count: b1Count,
      bowl2Count: b2Count,
      completedCount,
      avgCo2Bowl1: avgB1,
      avgCo2Bowl2: avgB2,
      avgCo2Saved: avgSaved,
      percentReduction,
      totalKgSaved,
      totalKmSaved,
      eatLancetPassCount: eatLancetCount,
      eatLancetPassPercent: b2Count > 0 ? Math.round((eatLancetCount / b2Count) * 100) : 0,
      topProteinFase1: getTopProtein(proteinCount1),
      topProteinFase2: getTopProtein(proteinCount2)
    }
  })
}

