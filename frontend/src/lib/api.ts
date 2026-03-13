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
    .from('sessions')
    .insert({ code, phase: 1 })
    .select('*')
    .single()

  if (error || !data) {
    throw error ?? new Error('Impossibile creare la sessione')
  }

  return data as Session
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  const { data, error } = await supabase.from('sessions').select('*').eq('code', code.trim().toUpperCase()).maybeSingle()
  if (error) throw error
  return (data ?? null) as Session | null
}

export async function createParticipant(sessionId: string): Promise<Participant> {
  const { data, error } = await supabase.from('participants').insert({ session_id: sessionId }).select('*').single()
  if (error || !data) {
    throw error ?? new Error('Impossibile creare il partecipante')
  }
  return data as Participant
}

export async function updateSessionPhase(sessionId: string, phase: SessionPhase): Promise<void> {
  const { error } = await supabase.from('sessions').update({ phase }).eq('id', sessionId)
  if (error) throw error
}

export async function fetchSession(sessionId: string): Promise<Session> {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
  if (error || !data) throw error ?? new Error('Sessione non trovata')
  return data as Session
}

export async function countParticipants(sessionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('participants')
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
  const { data, error } = await supabase.from('bowls').insert(input).select('*').single()
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
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .single()
  if (pErr || !participant) throw pErr ?? new Error('Partecipante non trovato')

  const { data: bowls, error } = await supabase
    .from('bowls')
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
  participantNumber: number | null
  bowl1?: Bowl
  bowl2?: Bowl
}

export async function finalizeSessionAndAssignNumbers(sessionId: string): Promise<void> {
  const { data: participants, error } = await supabase
    .from('participants')
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
      .from('participants')
      .update({ number: index })
      .eq('id', p.id)
    if (updErr) throw updErr
    index += 1
  }

  await updateSessionPhase(sessionId, 3)
}

export async function resetSession(sessionId: string): Promise<void> {
  const { error: bErr } = await supabase.from('bowls').delete().eq('session_id', sessionId)
  if (bErr) throw bErr

  const { error: pErr } = await supabase
    .from('participants')
    .update({ number: null })
    .eq('session_id', sessionId)
  if (pErr) throw pErr

  await updateSessionPhase(sessionId, 1)
}

export async function fetchOpenSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .in('phase', [1, 2, 3])
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw error
  return (data ?? []) as Session[]
}

export async function fetchClassSummary(sessionId: string): Promise<ClassSummaryRow[]> {
  const { data: participants, error: pErr } = await supabase
    .from('participants')
    .select('*')
    .eq('session_id', sessionId)

  if (pErr) throw pErr

  const { data: bowls, error: bErr } = await supabase.from('bowls').select('*').eq('session_id', sessionId)
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
      participantNumber: p.number,
      bowl1: pair.bowl1,
      bowl2: pair.bowl2
    }
  }) ?? []
}
