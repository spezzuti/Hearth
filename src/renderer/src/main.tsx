import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");

class HearthErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: true } {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Avoid echoing paths, prompts, or project content into renderer logs.
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="renderer-recovery" role="alert">
        <div className="renderer-recovery__mark" aria-hidden="true">⌂</div>
        <p className="eyebrow">Hearth needs a moment</p>
        <h1>This room didn’t finish opening.</h1>
        <p>Your projects and saved Hearth data have not been changed.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload Hearth
        </button>
      </main>
    );
  }
}

if (!root) {
  throw new Error("Hearth could not find its renderer root.");
}

createRoot(root).render(
  <StrictMode>
    <HearthErrorBoundary>
      <App />
    </HearthErrorBoundary>
  </StrictMode>
);
