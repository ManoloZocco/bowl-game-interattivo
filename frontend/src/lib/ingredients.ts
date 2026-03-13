import type { Ingredient } from './types'

export const INGREDIENTS: Ingredient[] = [
  // Basi
  { id: 'riso_bianco', category: 'base', label: 'Riso bianco', co2_g: 365, image: 'riso_bianco.png' },
  { id: 'riso_nero', category: 'base', label: 'Riso nero', co2_g: 365, image: 'riso_nero.png' },
  { id: 'riso_integrale', category: 'base', label: 'Riso integrale', co2_g: 365, image: 'riso_integrale.png' },
  { id: 'patate', category: 'base', label: 'Patate', co2_g: 92, image: 'patate.png' },
  { id: 'noodles', category: 'base', label: 'Noodles', co2_g: 79, image: 'noodles.png' },
  // Proteine
  { id: 'salmone', category: 'protein', label: 'Salmone', co2_g: 2045, image: 'salmone.png' },
  { id: 'ceci', category: 'protein', label: 'Ceci', co2_g: 90, image: 'ceci.png' },
  { id: 'feta', category: 'protein', label: 'Feta', co2_g: 1791, image: 'feta.png' },
  { id: 'gamberi', category: 'protein', label: 'Gamberi', co2_g: 4031, image: 'gamberi.png' },
  { id: 'manzo', category: 'protein', label: 'Manzo', co2_g: 9948, image: 'manzo.png' },
  { id: 'uova', category: 'protein', label: 'Uova', co2_g: 510, image: 'uova.png' },
  { id: 'suino', category: 'protein', label: 'Suino', co2_g: 1231, image: 'suino.png' },
  { id: 'tofu', category: 'protein', label: 'Tofu', co2_g: 1091, image: 'tofu.png' },
  { id: 'pollo', category: 'protein', label: 'Pollo', co2_g: 1231, image: 'pollo.png' },
  // Ingredienti extra
  { id: 'banana', category: 'ingredient', label: 'Banana', co2_g: 129, image: 'banana.png' },
  { id: 'carote', category: 'ingredient', label: 'Carote', co2_g: 87, image: 'carote.png' },
  { id: 'cipolla_rossa', category: 'ingredient', label: 'Cipolla rossa', co2_g: 100, image: 'cipolla_rossa.png' },
  { id: 'cavolo_rosso', category: 'ingredient', label: 'Cavolo rosso', co2_g: 102, image: 'cavolo_rosso.png' },
  { id: 'zucchine', category: 'ingredient', label: 'Zucchine', co2_g: 106, image: 'zucchine.png' },
  { id: 'ananas', category: 'ingredient', label: 'Ananas', co2_g: 158, image: 'ananas.png' },
  { id: 'mirtilli', category: 'ingredient', label: 'Mirtilli', co2_g: 230, image: 'mirtilli.png' },
  { id: 'avocado', category: 'ingredient', label: 'Avocado', co2_g: 254, image: 'avocado.png' },
  { id: 'olio_oliva', category: 'ingredient', label: 'Olio di oliva', co2_g: 54, image: 'olio_oliva.png' },
  { id: 'olive_nere', category: 'ingredient', label: 'Olive nere', co2_g: 15, image: 'olive_nere.png' },
  { id: 'noci', category: 'ingredient', label: 'Noci', co2_g: 13, image: 'noci.png' },
  { id: 'arachidi', category: 'ingredient', label: 'Arachidi', co2_g: 97, image: 'arachidi.png' },
  { id: 'pistacchi', category: 'ingredient', label: 'Pistacchi', co2_g: 13, image: 'pistacchi.png' },
  { id: 'pomodorini', category: 'ingredient', label: 'Pomodorini', co2_g: 418, image: 'pomodorini.png' },
  { id: 'mele', category: 'ingredient', label: 'Mele', co2_g: 65, image: 'mele.png' }
]

export const BASES = INGREDIENTS.filter((i) => i.category === 'base')
export const PROTEINS = INGREDIENTS.filter((i) => i.category === 'protein')
export const EXTRAS = INGREDIENTS.filter((i) => i.category === 'ingredient')

export function computeCo2(ids: string[]): number {
  return ids
    .map((id) => INGREDIENTS.find((i) => i.id === id)?.co2_g ?? 0)
    .reduce((sum, v) => sum + v, 0)
}
