import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../contexts/AuthContext'

// Mock Supabase client
const mockGetSession = vi.fn()
const mockSignUp = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignInWithOAuth = vi.fn()
const mockLinkIdentity = vi.fn()
const mockGetUserIdentities = vi.fn()
const mockUnlinkIdentity = vi.fn()
const mockSignOut = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signUp: (params: object) => mockSignUp(params),
      signInWithPassword: (params: object) => mockSignInWithPassword(params),
      signInWithOAuth: (params: object) => mockSignInWithOAuth(params),
      linkIdentity: (params: object) => mockLinkIdentity(params),
      getUserIdentities: () => mockGetUserIdentities(),
      unlinkIdentity: (params: object) => mockUnlinkIdentity(params),
      signOut: () => mockSignOut(),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        mockOnAuthStateChange(callback)
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
  },
}))

// Test component that uses the hook
function TestComponent() {
  const { user, loading, signIn, signUp, signOut } = useAuth()

  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'loaded'}</span>
      <span data-testid="user">{user ? user.email : 'no user'}</span>
      <button onClick={() => signIn('test@example.com', 'password')} data-testid="sign-in">
        Sign In
      </button>
      <button onClick={() => signUp('test@example.com', 'password')} data-testid="sign-up">
        Sign Up
      </button>
      <button onClick={signOut} data-testid="sign-out">
        Sign Out
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: null },
    })
  })

  it('provides loading state initially', async () => {
    mockGetSession.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('loading')
  })

  it('provides null user when not authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('no user')
  })

  it('provides user when authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-123', email: 'test@example.com' },
        },
      },
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
  })

  it('throws error when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })

  it('calls signInWithPassword on signIn', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockSignInWithPassword.mockResolvedValue({ error: null })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    await act(async () => {
      screen.getByTestId('sign-in').click()
    })

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    })
  })

  it('calls supabase signUp on signUp', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockSignUp.mockResolvedValue({ error: null })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    await act(async () => {
      screen.getByTestId('sign-up').click()
    })

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    })
  })

  it('calls supabase signOut on signOut', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockSignOut.mockResolvedValue({ error: null })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
    })

    await act(async () => {
      screen.getByTestId('sign-out').click()
    })

    expect(mockSignOut).toHaveBeenCalled()
  })

  it('subscribes to auth state changes', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(mockOnAuthStateChange).toHaveBeenCalled()
  })
})
