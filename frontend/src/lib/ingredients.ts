import type { Ingredient } from './types'

export const INGREDIENTS: Ingredient[] = [
  // Basi
  { id: 'riso_bianco', category: 'base', label: 'Riso bianco', co2_g: 365, icon: '🍚', portion: 'Porzione 150g' },
  { id: 'riso_nero', category: 'base', label: 'Riso nero', co2_g: 365, icon: '🌾', portion: 'Porzione 150g' },
  { id: 'riso_integrale', category: 'base', label: 'Riso integrale', co2_g: 365, icon: '🌾', portion: 'Porzione 150g' },
  { id: 'patate', category: 'base', label: 'Patate lesse', co2_g: 92, icon: '🥔', portion: 'Porzione 150g' },
  { id: 'noodles', category: 'base', label: 'Noodles', co2_g: 79, icon: '🍜', portion: 'Porzione 150g' },
  // Proteine
  { id: 'salmone', category: 'protein', label: 'Salmone', co2_g: 2045, icon: '🐟', portion: 'Porzione 80g' },
  { id: 'ceci', category: 'protein', label: 'Ceci locali', co2_g: 90, icon: '🧆', portion: 'Porzione 80g' },
  { id: 'feta', category: 'protein', label: 'Feta', co2_g: 1791, icon: '🧀', portion: 'Porzione 60g' },
  { id: 'gamberi', category: 'protein', label: 'Gamberi', co2_g: 4031, icon: '🦐', portion: 'Porzione 80g' },
  { id: 'manzo', category: 'protein', label: 'Manzo', co2_g: 9948, icon: '🥩', portion: 'Porzione 80g' },
  { id: 'uova', category: 'protein', label: 'Uova bio', co2_g: 510, icon: '🥚', portion: 'Porzione 1 pz' },
  { id: 'suino', category: 'protein', label: 'Suino', co2_g: 1231, icon: '🥓', portion: 'Porzione 80g' },
  { id: 'tofu', category: 'protein', label: 'Tofu', co2_g: 1091, icon: '🧊', portion: 'Porzione 80g' },
  { id: 'pollo', category: 'protein', label: 'Pollo', co2_g: 1231, icon: '🍗', portion: 'Porzione 80g' },
  // Ingredienti extra
  { id: 'banana', category: 'ingredient', label: 'Banana', co2_g: 129, icon: '🍌', portion: 'Porzione 50g' },
  { id: 'carote', category: 'ingredient', label: 'Carote julienne', co2_g: 87, icon: '🥕', portion: 'Porzione 50g' },
  { id: 'cipolla_rossa', category: 'ingredient', label: 'Cipolla rossa', co2_g: 100, icon: '🧅', portion: 'Porzione 30g' },
  { id: 'cavolo_rosso', category: 'ingredient', label: 'Cavolo rosso', co2_g: 102, icon: '🥬', portion: 'Porzione 50g' },
  { id: 'zucchine', category: 'ingredient', label: 'Zucchine', co2_g: 106, icon: '🥒', portion: 'Porzione 50g' },
  { id: 'ananas', category: 'ingredient', label: 'Ananas', co2_g: 158, icon: '🍍', portion: 'Porzione 40g' },
  { id: 'mirtilli', category: 'ingredient', label: 'Mirtilli freschi', co2_g: 230, icon: '🫐', portion: 'Porzione 40g' },
  { id: 'avocado', category: 'ingredient', label: 'Avocado', co2_g: 254, icon: '🥑', portion: 'Porzione 50g' },
  { id: 'olio_oliva', category: 'ingredient', label: 'Olio extravergine', co2_g: 54, icon: '🫒', portion: 'Porzione 10g' },
  { id: 'olive_nere', category: 'ingredient', label: 'Olive nere', co2_g: 15, icon: '🫒', portion: 'Porzione 20g' },
  { id: 'noci', category: 'ingredient', label: 'Noci toscane', co2_g: 13, icon: '🥜', portion: 'Porzione 15g' },
  { id: 'arachidi', category: 'ingredient', label: 'Arachidi tostate', co2_g: 97, icon: '🥜', portion: 'Porzione 15g' },
  { id: 'pistacchi', category: 'ingredient', label: 'Pistacchi', co2_g: 13, icon: '🟢', portion: 'Porzione 15g' },
  { id: 'pomodorini', category: 'ingredient', label: 'Pomodorini', co2_g: 418, icon: '🍅', portion: 'Porzione 60g' },
  { id: 'mele', category: 'ingredient', label: 'Mela a cubetti', co2_g: 65, icon: '🍎', portion: 'Porzione 50g' }
]

export const BASES = INGREDIENTS.filter((i) => i.category === 'base')
export const PROTEINS = INGREDIENTS.filter((i) => i.category === 'protein')
export const EXTRAS = INGREDIENTS.filter((i) => i.category === 'ingredient')

export function getIngredient(id: string): Ingredient | undefined {
  return INGREDIENTS.find((i) => i.id === id)
}

export function computeCo2(ids: string[]): number {
  return ids
    .map((id) => INGREDIENTS.find((i) => i.id === id)?.co2_g ?? 0)
    .reduce((sum, v) => sum + v, 0)
}

