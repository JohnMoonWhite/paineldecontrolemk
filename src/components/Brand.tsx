export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand${compact ? ' brand--compact' : ''}`}>
    <img className="brand-lockup" src="/brand/mkhub-lockup.png" alt="MKHub" width="699" height="96" />
    <small className="brand-caption">Controle do negócio</small>
  </div>
}
