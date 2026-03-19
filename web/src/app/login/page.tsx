'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import {
  Shield, Eye, EyeOff, Wifi, Lock, Mail, AlertCircle, Loader2,
} from 'lucide-react'

/**
 * Login Page — Cruci-Track Access Control
 *
 * Authentication strategy:
 * - signInWithPassword: email + password via Supabase Auth
 * - No public registration — access is provisioned internally
 * - Session stored in cookies via @supabase/ssr (readable by middleware + Server Components)
 * - Post-login redirect honours the `redirectTo` query param set by the middleware guard
 */
export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return

    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Credenciales inválidas. Verifica tu email y contraseña.'
          : authError.message
      )
      setLoading(false)
      return
    }

    // Successful auth — navigate to the intended destination
    router.push(redirectTo)
    router.refresh()
  }, [email, password, redirectTo, router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-red-900/10 rounded-full blur-[80px]" />
      </div>

      {/* Grid texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-md relative z-10">

        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-600 rounded-[2rem] shadow-[0_0_60px_rgba(220,38,38,0.4)] mb-6">
            <span className="text-white font-black italic text-2xl tracking-tighter">CT</span>
          </div>
          <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">
            CRUCI
            <span className="text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">TRACK</span>
          </h1>
          <p className="text-neutral-600 text-[10px] font-black uppercase tracking-[0.4em] mt-3 italic">
            Sistema de Auditoría de Telemetría
          </p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-[3rem] p-12 shadow-2xl backdrop-blur-xl">

          {/* Status badge */}
          <div className="flex items-center gap-3 bg-red-600/10 border border-red-600/20 rounded-full px-5 py-2 w-fit mx-auto mb-10">
            <Wifi size={10} className="text-red-600 animate-pulse" />
            <span className="text-red-600 text-[9px] font-black uppercase tracking-[0.3em] italic">
              Acceso Restringido
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] italic">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ADMIN@CRUCIANELLI.COM"
                  required
                  autoComplete="email"
                  className="w-full bg-black border border-neutral-800 rounded-2xl pl-12 pr-5 py-5 text-white font-black italic uppercase text-[11px] outline-none focus:border-red-600 transition-all placeholder:text-neutral-700 tracking-wider"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] italic">
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-black border border-neutral-800 rounded-2xl pl-12 pr-14 py-5 text-white font-black text-[11px] outline-none focus:border-red-600 transition-all placeholder:text-neutral-700 tracking-[0.3em]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-3 bg-red-600/10 border border-red-600/30 rounded-2xl px-5 py-4 animate-in fade-in duration-300">
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <p className="text-red-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.4em] italic transition-all shadow-[0_0_30px_rgba(220,38,38,0.2)] active:scale-95 flex items-center justify-center gap-3 mt-8"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Shield size={18} />
                  Acceder al Sistema
                </>
              )}
            </button>
          </form>

          {/* No public sign-up — by design */}
          <p className="text-center text-neutral-700 text-[9px] font-black uppercase tracking-[0.3em] italic mt-8">
            El acceso es gestionado internamente por el equipo de Crucianelli.
          </p>
        </div>

        {/* Version stamp */}
        {mounted && (
          <p className="text-center text-neutral-800 text-[8px] font-black uppercase tracking-[0.3em] italic mt-8">
            Cruci-Track v2.0 · {new Date().getFullYear()} Crucianelli S.A.
          </p>
        )}
      </div>
    </div>
  )
}
