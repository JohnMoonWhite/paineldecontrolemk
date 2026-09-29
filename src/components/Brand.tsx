export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand${compact ? ' brand--compact' : ''}`}>
    <span className="brand-symbol" aria-hidden="true" />
    <span className="brand-name">MK<span>HUB</span><i>.</i><small>Controle do negócio</small></span>
  </div>
}
