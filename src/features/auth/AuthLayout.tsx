import type { ReactNode } from 'react'
import { Brand } from '../../components/Brand'
import { Icon } from '../../components/Icon'

export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="access-shell">
    <aside className="brand-panel">
      <Brand />
      <div className="brand-story">
        <img className="brand-art" src="/brand/mkhub.png" alt="MKHUB — Softwares e sistemas inteligentes" width="1536" height="1024" />
        <h2>Seu negócio,<br />por inteiro.</h2>
        <p>Assinaturas, projetos e sinais de atenção.<br />Uma visão clara para a próxima decisão.</p>
      </div>
      <div className="brand-panel-footer"><span>Controle. Gestão. Resultados.</span><span>MKHUB / Painel privado</span></div>
    </aside>
    <div className="auth-content"><div className="mobile-brand"><Brand /></div>{children}<p className="security-note"><Icon name="shield" />Acesso protegido por autenticação em duas etapas</p></div>
  </main>
}
