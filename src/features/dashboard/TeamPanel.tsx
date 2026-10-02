import { useState } from 'react'

export type TeamMember = { user_id: string; name: string; role: string; is_me: boolean }

const roleLabels: Record<string, string> = { owner: 'Dono', editor: 'Pode lançar', viewer: 'Só visualiza' }

/** Who can see and who can record in the dashboard; owners change the levels here. */
export function TeamPanel({ team, onRoleChange }: { team: TeamMember[]; onRoleChange: (userId: string, role: string) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null)
  const iAmOwner = team.some(member => member.is_me && member.role === 'owner')

  async function change(userId: string, role: string) {
    setError(null)
    try { await onRoleChange(userId, role) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o acesso.') }
  }

  return <section className="panel team-panel" aria-labelledby="team-title">
    <div className="section-heading"><div><h2 id="team-title">Equipe e acessos</h2><p>Dono gerencia acessos · Pode lançar registra no caixa · Só visualiza apenas consulta</p></div><span className="count-label">{team.length} {team.length === 1 ? 'pessoa' : 'pessoas'}</span></div>
    <ul className="team-list">{team.map(member => {
      const label = `Acesso de ${member.name}${member.is_me ? ' (você)' : ''}`
      return <li key={member.user_id}>
        <span className="source-avatar">{member.name.slice(0, 2)}</span>
        <strong>{member.name}{member.is_me ? <small> (você)</small> : null}</strong>
        {iAmOwner
          ? <select aria-label={label} value={member.role} disabled={member.is_me} title={member.is_me ? 'Peça a outro dono para alterar o seu acesso.' : undefined} onChange={event => void change(member.user_id, event.target.value)}>
              {Object.entries(roleLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          : <span className="status-badge status-badge--neutral">{roleLabels[member.role] ?? member.role}</span>}
      </li>
    })}</ul>
    {error ? <p className="form-error team-error" role="alert">{error}</p> : null}
    <p className="table-note">Novas pessoas precisam de uma conta no painel; peça à equipe técnica para incluí-las.</p>
  </section>
}
