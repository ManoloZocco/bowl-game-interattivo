import type { Ingredient } from './types'

export const INGREDIENTS: Ingredient[] = [
  // Basi
  { id: 'riso_bianco', category: 'base', label: 'Riso bianco', co2_g: 365 },
  { id: 'riso_nero', category: 'base', label: 'Riso nero', co2_g: 365 },
  { id: 'riso_integrale', category: 'base', label: 'Riso integrale', co2_g: 365 },
  { id: 'patate', category: 'base', label: 'Patate', co2_g: 92 },
  { id: 'noodles', category: 'base', label: 'Noodles', co2_g: 79 },
  // Proteine
  { id: 'salmone', category: 'protein', label: 'Salmone', co2_g: 2045 },
  { id: 'ceci', category: 'protein', label: 'Ceci', co2_g: 90 },
  { id: 'feta', category: 'protein', label: 'Feta', co2_g: 1791 },
  { id: 'gamberi', category: 'protein', label: 'Gamberi', co2_g: 4031 },
  { id: 'manzo', category: 'protein', label: 'Manzo', co2_g: 9948 },
  { id: 'uova', category: 'protein', label: 'Uova', co2_g: 510 },
  { id: 'suino', category: 'protein', label: 'Suino', co2_g: 1231 },
  { id: 'tofu', category: 'protein', label: 'Tofu', co2_g: 1091 },
  { id: 'pollo', category: 'protein', label: 'Pollo', co2_g: 1231 },
  // Ingredienti extra
  { id: 'banana', category: 'ingredient', label: 'Banana', co2_g: 129 },
  { id: 'carote', category: 'ingredient', label: 'Carote', co2_g: 87 },
  { id: 'cipolla_rossa', category: 'ingredient', label: 'Cipolla rossa', co2_g: 100 },
  { id: 'cavolo_rosso', category: 'ingredient', label: 'Cavolo rosso', co2_g: 102 },
  { id: 'zucchine', category: 'ingredient', label: 'Zucchine', co2_g: 106 },
  { id: 'ananas', category: 'ingredient', label: 'Ananas', co2_g: 158 },
  { id: 'mirtilli', category: 'ingredient', label: 'Mirtilli', co2_g: 230 },
  { id: 'avocado', category: 'ingredient', label: 'Avocado', co2_g: 254 },
  { id: 'olio_oliva', category: 'ingredient', label: 'Olio di oliva', co2_g: 54 },
  { id: 'olive_nere', category: 'ingredient', label: 'Olive nere', co2_g: 15 },
  { id: 'noci', category: 'ingredient', label: 'Noci', co2_g: 13 },
  { id: 'arachidi', category: 'ingredient', label: 'Arachidi', co2_g: 97 },
  { id: 'pistacchi', category: 'ingredient', label: 'Pistacchi', co2_g: 13 },
  { id: 'pomodorini', category: 'ingredient', label: 'Pomodorini', co2_g: 418 },
  { id: 'mele', category: 'ingredient', label: 'Mele', co2_g: 65 }
]

export const BASES = INGREDIENTS.filter((i) => i.category === 'base')
export const PROTEINS = INGREDIENTS.filter((i) => i.category === 'protein')
export const EXTRAS = INGREDIENTS.filter((i) => i.category === 'ingredient')

export function computeCo2(ids: string[]): number {
  return ids
    .map((id) => INGREDIENTS.find((i) => i.id === id)?.co2_g ?? 0)
    .reduce((sum, v) => sum + v, 0)
}
