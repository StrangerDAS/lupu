import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <FiAlertTriangle className="text-3xl text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Module Crashed</h2>
          <p className="text-white/50 text-sm max-w-md mb-6">
            Something went wrong while rendering this section. Our team has been notified.
          </p>
          <div className="bg-black/50 border border-red-500/20 p-4 rounded-xl text-left max-w-2xl overflow-auto text-xs font-mono text-red-300 w-full">
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-6 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition text-sm font-semibold"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
