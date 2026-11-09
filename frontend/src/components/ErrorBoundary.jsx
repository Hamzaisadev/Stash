import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-[10px] border-2 border-slate-900 p-6 sm:p-8 shadow-[3px_3px_0_0_var(--color-slate-900)] text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              An unexpected error occurred while rendering the page. Reloading the application usually resolves this.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold shadow-sm shadow-red-500/20 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
