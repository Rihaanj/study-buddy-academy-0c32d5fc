import { Component, type ErrorInfo, type ReactNode } from "react";
import { Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Starfield } from "@/components/Starfield";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Study Bud AI recovered from a page error", error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="relative grid min-h-screen place-items-center overflow-hidden px-5">
        <Starfield />
        <section className="glass-strong relative z-10 w-full max-w-md rounded-lg border border-border p-7 text-center shadow-glow">
          <img
            src="/icons/icon-192.png"
            alt="Study Bud AI"
            className="mx-auto h-20 w-20 object-contain"
            width={80}
            height={80}
          />
          <h1 className="mt-5 text-2xl font-bold shimmer-text">Let&apos;s get you back in orbit</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page hit a temporary problem. Your account and study progress are safe.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={this.reload} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
            <Button onClick={this.goHome} variant="outline" className="gap-2">
              <Home className="h-4 w-4" /> Home
            </Button>
          </div>
        </section>
      </main>
    );
  }
}