const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "R$ 1.234,56" with a plain space, so values never wrap oddly. */
export const money = (cents: number) => currency.format(cents / 100).replace(/\s/g, ' ')

/** "1234,56" (with sign), the number format spreadsheets in pt-BR expect. */
export const plainAmount = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

export function monthLabel(month: string) {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function formatDay(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
