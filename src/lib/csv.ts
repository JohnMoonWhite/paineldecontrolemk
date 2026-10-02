/** Semicolon CSV with BOM, the format Excel in pt-BR opens directly. */
export function toCsv(header: string[], rows: string[][]): string {
  return '﻿' + [header, ...rows].map(row => row.map(cell).join(';')).join('\r\n')
}

function cell(value: string): string {
  // A leading =, +, - or @ would be run as a formula; numbers stay as they are.
  const safe = /^[=+@]/.test(value) || (/^-/.test(value) && !/^-[\d.,]+$/.test(value)) ? `'${value}` : value
  return /[;"\r\n]/.test(safe) || safe !== value ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
