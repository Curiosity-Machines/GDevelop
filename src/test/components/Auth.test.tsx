import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Auth } from '../../components/Auth'

// Mock the useAuth hook
const mockSignIn = vi.fn()
const mockSignUp = vi.fn()
const mockSignInWithOAuth = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    signInWithOAuth: mockSignInWithOAuth,
  }),
}))

describe('Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockResolvedValue({ error: null })
    mockSignUp.mockResolvedValue({ error: null })
    mockSignInWithOAuth.mockResolvedValue(undefined)
  })

  it('renders the sign in form by default', () => {
    render(<Auth />)

    expect(screen.getByText('Dopple Studio')).toBeInTheDocument()
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('renders GitHub OAuth button', () => {
    render(<Auth />)

    expect(screen.getByRole('button', { name: /Continue with GitHub/i })).toBeInTheDocument()
  })

  it('toggles between sign in and sign up modes', async () => {
    render(<Auth />)

    // Initially in sign in mode
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()

    // Click toggle to switch to sign up
    const toggleButton = screen.getByRole('button', { name: 'Sign Up' })
    fireEvent.click(toggleButton)

    expect(screen.getByText('Create a new account')).toBeInTheDocument()

    // Click toggle to switch back to sign in
    const signInToggle = screen.getByRole('button', { name: 'Sign In' })
    fireEvent.click(signInToggle)

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
  })

  it('calls signIn with email and password on submit', async () => {
    render(<Auth />)

    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign In' })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123')
    })
  })

  it('calls signUp with email and password in signup mode', async () => {
    render(<Auth />)

    // Switch to signup mode
    const toggleButton = screen.getByRole('button', { name: 'Sign Up' })
    fireEvent.click(toggleButton)

    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign Up' })

    fireEvent.change(emailInput, { target: { value: 'new@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'newpassword123')
    })
  })

  it('displays error message when sign in fails', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } })

    render(<Auth />)

    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign In' })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('displays success message when sign up succeeds', async () => {
    render(<Auth />)

    // Switch to signup mode
    const toggleButton = screen.getByRole('button', { name: 'Sign Up' })
    fireEvent.click(toggleButton)

    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign Up' })

    fireEvent.change(emailInput, { target: { value: 'new@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'newpassword123' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Check your email for a confirmation link.')).toBeInTheDocument()
    })
  })

  it('calls signInWithOAuth when GitHub button is clicked', async () => {
    render(<Auth />)

    const githubButton = screen.getByRole('button', { name: /Continue with GitHub/i })
    fireEvent.click(githubButton)

    expect(mockSignInWithOAuth).toHaveBeenCalledWith('github')
  })

  it('disables submit button while loading', async () => {
    // Make signIn take some time
    mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ error: null }), 100)))

    render(<Auth />)

    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: 'Sign In' })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })
    fireEvent.click(submitButton)

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Loading...' })).toBeInTheDocument()
    })
  })
})
