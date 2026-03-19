'use client'

import React, { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional custom fallback. If omitted, renders the default industrial-dark error card. */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React Error Boundary for Cruci-Track modules.
 *
 * Catches render-time exceptions from any descendant component and renders
 * a consistent, branded error state rather than crashing the whole page.
 * Each route section should be wrapped independently so a failure in one
 * module (e.g. the BI charts) doesn't take down the rest of the UI.
 *
 * @example
 * <ErrorBoundary>
 *   <AnaliticaCharts />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[Cruci-Track ErrorBoundary]', error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-[300px] p-12 bg-neutral-900/50 border border-red-600/30 rounded-[3rem] text-center">
            <div className="p-5 bg-red-600/10 rounded-2xl mb-6">
              <AlertTriangle size={40} className="text-red-600" />
            </div>
            <h3 className="text-white font-black italic uppercase tracking-tighter text-2xl mb-3">
              Error de Módulo
            </h3>
            <p className="text-neutral-500 font-mono text-xs max-w-md leading-relaxed mb-8">
              {this.state.error?.message ?? 'Error inesperado en el sistema de telemetría.'}
            </p>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-3 px-8 py-4 bg-neutral-800 hover:bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
            >
              <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}
