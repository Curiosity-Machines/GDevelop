import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * CLI Auth page.
 * Two modes:
 * 1. No hash → show "Login with GitHub" button that starts OAuth with
 *    redirectTo pointing back to this page.
 * 2. Hash with tokens → extract refresh token, encode as short code,
 *    display for user to copy and paste into terminal.
 */
export function CliAuth() {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    // Check sessionStorage first (captured by inline script before Supabase consumes hash)
    const hash = sessionStorage.getItem('cli-auth-hash') || window.location.hash.substring(1)
    sessionStorage.removeItem('cli-auth-hash')

    if (!hash) {
      // No tokens yet — user needs to log in
      return
    }

    const params = new URLSearchParams(hash)
    const refreshToken = params.get('refresh_token')

    if (!refreshToken) {
      setError('Missing refresh token in callback.')
      return
    }

    setCode('dopple:' + btoa(refreshToken))
  }, [])

  useEffect(() => {
    // After OAuth redirect back, check if we have a session (flag was set before OAuth)
    if (sessionStorage.getItem('dopple-cli-auth')) {
      sessionStorage.removeItem('dopple-cli-auth')
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.refresh_token) {
          setCode('dopple:' + btoa(session.refresh_token))
        }
      })
    }
  }, [])

  const handleLogin = async () => {
    setLoggingIn(true)
    // Set flag so we know to show the code after OAuth redirect
    sessionStorage.setItem('dopple-cli-auth', '1')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/cli-auth`,
      },
    })
    if (error) {
      setError(`Login failed: ${error.message}`)
      setLoggingIn(false)
      sessionStorage.removeItem('dopple-cli-auth')
    }
  }

  const handleCopy = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      fontFamily: '-apple-system, system-ui, sans-serif',
      maxWidth: '480px',
      margin: '80px auto',
      textAlign: 'center',
      padding: '0 20px',
    }}>
      {error && (
        <div>
          <h2 style={{ color: '#dc2626' }}>Login failed</h2>
          <p>{error}</p>
        </div>
      )}

      {code && (
        <div>
          <h2>Paste this code in your terminal</h2>
          <div
            onClick={handleCopy}
            style={{
              fontFamily: 'monospace',
              fontSize: '20px',
              background: '#f0f0f0',
              padding: '16px 24px',
              borderRadius: '8px',
              margin: '20px 0',
              letterSpacing: '1px',
              userSelect: 'all',
              cursor: 'pointer',
              wordBreak: 'break-all',
            }}
          >
            {code}
          </div>
          <button
            onClick={handleCopy}
            style={{
              padding: '10px 24px',
              fontSize: '16px',
              cursor: 'pointer',
              border: 'none',
              background: copied ? '#22c55e' : '#2563eb',
              color: 'white',
              borderRadius: '6px',
            }}
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
          <p style={{ marginTop: '24px', color: '#666' }}>
            You can close this tab after pasting the code.
          </p>
        </div>
      )}

      {!error && !code && (
        <div>
          <h2>Dopple CLI Login</h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            Sign in to connect your terminal to Dopple Studio.
          </p>
          <button
            onClick={handleLogin}
            disabled={loggingIn}
            style={{
              padding: '12px 32px',
              fontSize: '16px',
              cursor: loggingIn ? 'wait' : 'pointer',
              border: 'none',
              background: '#24292f',
              color: 'white',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="white">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            {loggingIn ? 'Redirecting...' : 'Sign in with GitHub'}
          </button>
        </div>
      )}
    </div>
  )
}
