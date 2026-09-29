import type { ReactNode } from 'react'
import { Brand } from '../../components/Brand'
import { Icon } from '../../components/Icon'

export function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="access-shell">
    <aside className="brand-panel">
      <p className="access-caption">Painel de controle MKHUB</p>
      <div className="brand-story">
        <img className="brand-art" src="/brand/mkhub.png" alt="MKHUB — Softwares e sistemas inteligentes" width="1536" height="1024" />
        <h2>Seu negócio.<br />Sua visão completa.</h2>
        <p>Acompanhe seus projetos, assinaturas e o que precisa da sua atenção.</p>
      </div>
      <div className="brand-panel-footer"><span>Softwares e sistemas inteligentes</span><span>Painel privado</span></div>
    </aside>
    <div className="auth-content"><div className="mobile-brand"><Brand /></div>{children}<p className="security-note"><Icon name="shield" />Acesso protegido por autenticação em duas etapas</p></div>
  </main>
}
