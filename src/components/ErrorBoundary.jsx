import { Component } from 'react'
import { reportError } from '../lib/errors'

// A crash while drawing the screen: report it and offer a reload instead of a blank page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    reportError('render', { message: error?.message, stack: `${error?.stack ?? ''}\n${info?.componentStack ?? ''}` })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="crash">
        <img src="/icon-192.png" alt="" width="72" height="72" />
        <h1>Bir şeyler ters gitti</h1>
        <p>Sorunu bize otomatik olarak bildirdik. Sayfayı yenilersen kaldığın yerden devam edebilirsin.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Yeniden yükle
        </button>
      </main>
    )
  }
}
