'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Acceso denegado. Verifique sus credenciales.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-10 backdrop-blur-xl shadow-2xl">
        <div className="text-center">
          <span className="text-xs font-bold tracking-[0.3em] text-red-600 uppercase">Crucianelli</span>
          <h1 className="mt-2 text-4xl font-black tracking-tighter text-white italic">CRUCI TRACK</h1>
          <p className="mt-4 text-sm text-neutral-500 font-medium">SISTEMA CENTRAL DE POSVENTA</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-500 ml-1">Email Corporativo</label>
              <input
                type="email"
                required
                className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all shadow-inner"
                placeholder="ejemplo@crucianelli.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-500 ml-1">Contraseña</label>
              <input
                type="password"
                required
                className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-white focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all shadow-inner"
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-900/50 p-3 rounded-lg">
              <p className="text-xs text-red-500 text-center font-bold uppercase tracking-wider">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-red-600 py-4 text-xs font-black text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 transition-all uppercase tracking-widest shadow-lg shadow-red-900/20"
          >
            {loading ? 'Validando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}