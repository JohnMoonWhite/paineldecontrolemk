import { Icon } from '../../components/Icon'

export function UpdateBanner({ visible, onUpdate, onDismiss }: { visible: boolean; onUpdate: () => void; onDismiss: () => void }) {
  if (!visible) return null
  return <div className="update-banner" role="status">
    <Icon name="refresh" />
    <p><strong>Nova versão do painel disponível</strong><span>Atualize para ver as últimas melhorias.</span></p>
    <button className="primary-button" type="button" onClick={onUpdate}>Atualizar agora</button>
    <button className="text-button" type="button" onClick={onDismiss}>Depois</button>
  </div>
}
