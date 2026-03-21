import { useEffect, useState } from 'react'

/**
 * CLI Auth callback page.
 * Supabase redirects here after OAuth with tokens in the URL hash.
 * Extracts the refresh token, encodes it as a short code, and displays
 * it for the user to copy and paste into their terminal.
 */
export function CliAuth() {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Hash is captured by inline script in index.html before Supabase
    // client consumes it. Read from sessionStorage first, fall back to hash.
    const hash = sessionStorage.getItem('cli-auth-hash') || window.location.hash.substring(1)
    sessionStorage.removeItem('cli-auth-hash')

    if (!hash) {
      setError('No authentication tokens received.')
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
        <h2>Completing login...</h2>
      )}
    </div>
  )
}
