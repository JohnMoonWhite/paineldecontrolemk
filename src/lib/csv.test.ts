import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('builds a semicolon file that Excel in Portuguese opens with accents and quotes intact', () => {
    const csv = toCsv(['Data', 'Descrição', 'Valor'], [
      ['01/09/2026', 'Saldo "inicial"', '5000,00'],
      ['02/09/2026', 'Hospedagem; servidor', '-189,90'],
    ])

    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿Data;Descrição;Valor\r\n01/09/2026;"Saldo ""inicial""";5000,00\r\n02/09/2026;"Hospedagem; servidor";-189,90')
  })

  it('neutralizes values that a spreadsheet would run as formulas', () => {
    expect(toCsv(['Nome'], [['=HYPERLINK("x")']])).toContain(`"'=HYPERLINK(""x"")"`)
  })
})
