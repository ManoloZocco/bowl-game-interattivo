export type SessionPhase = 1 | 2 | 3
export type BowlPhase = 1 | 2

export interface Session {
  id: string
  code: string
  phase: SessionPhase
  created_at: string
}

export interface Participant {
  id: string
  session_id: string
  number: number | null
  created_at: string
}

export interface Ingredient {
  id: string
  category: string
  label: string
  co2_g: number
}

export interface Bowl {
  id: string
  session_id: string
  participant_id: string
  phase: BowlPhase
  size: 'regular' | 'large'
  base_id: string
  protein_ids: string[]
  ingredient_ids: string[]
  total_co2_g: number
  total_km: number
  created_at: string
}
