import './index.css'

function App() {
  return (
    <main className="access-shell">
      <section className="access-panel" aria-labelledby="access-title">
        <p className="product-mark">Painel de Controle</p>
        <h1 id="access-title">Acompanhe o que mantém o negócio em movimento.</h1>
        <p className="access-copy">
          Assinaturas, uso e sinais de atenção dos seus produtos em uma visão segura.
        </p>
        <button className="access-button" type="button">
          Entrar
        </button>
        <p className="access-note">O acesso é protegido por verificação em duas etapas.</p>
      </section>
      <aside className="access-structure" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </aside>
    </main>
  )
}

export default App
