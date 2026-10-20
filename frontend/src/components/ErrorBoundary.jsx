import { Component } from 'react';
export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="loading-screen">
          <h1>Let’s try that again.</h1>
          <p>Cashbook could not display this page. Your saved records are unaffected.</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Reload Cashbook
          </button>
        </main>
      );
    return this.props.children;
  }
}
