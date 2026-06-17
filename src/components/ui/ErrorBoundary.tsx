import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-6 font-sans select-none">
          <div className="max-w-md w-full bg-white/80 backdrop-blur-md p-10 rounded-[32px] border border-gray-100 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-serif font-semibold text-gray-900">Application Error</h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                The portal encountered an unexpected client-side crash. Don't worry, your data is secure.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100/50 text-left">
                <p className="text-[10px] uppercase tracking-widest font-bold text-red-500 mb-1">Error Message</p>
                <p className="text-xs font-mono text-red-700 break-words leading-normal max-h-24 overflow-y-auto no-scrollbar">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full py-4 bg-[#5A5A40] hover:bg-[#4E4E37] text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all shadow-md hover:shadow-lg cursor-pointer"
              >
                Clear Cache & Refresh
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="text-[#5A5A40] font-bold uppercase tracking-widest text-[10px] hover:underline cursor-pointer"
              >
                Just Reload Page
              </button>
            </div>

            <div className="text-[9px] text-gray-400 uppercase tracking-widest font-bold font-mono">
              KCFC Portal Resilience System
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
