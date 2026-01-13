import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AccountSettings } from '../../components/AccountSettings'

// Mock useAuth
const mockLinkIdentity = vi.fn()
const mockGetUserIdentities = vi.fn()
const mockUnlinkIdentity = vi.fn()

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
      last_sign_in_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    },
    linkIdentity: mockLinkIdentity,
    getUserIdentities: mockGetUserIdentities,
    unlinkIdentity: mockUnlinkIdentity,
  }),
}))

describe('AccountSettings', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserIdentities.mockResolvedValue({
      identities: [
        {
          id: 'identity-1',
          provider: 'email',
          identity_data: { email: 'test@example.com' },
        },
      ],
      error: null,
    })
    mockLinkIdentity.mockResolvedValue({ error: null })
    mockUnlinkIdentity.mockResolvedValue({ error: null })

    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('renders account settings modal', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Account Settings')).toBeInTheDocument()
    })
  })

  it('displays user email', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })
  })

  it('shows Account Information section', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Account Information')).toBeInTheDocument()
    })
  })

  it('shows Linked Accounts section', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Linked Accounts')).toBeInTheDocument()
    })
  })

  it('calls onClose when close button is clicked', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Account Settings')).toBeInTheDocument()
    })

    const closeButton = screen.getByText('×')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Account Settings')).toBeInTheDocument()
    })

    // Click the backdrop (outer container)
    const backdrop = screen.getByText('Account Settings').closest('.fixed')
    fireEvent.click(backdrop!)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('shows linked identities', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Email/Password')).toBeInTheDocument()
    })
  })

  it('shows Link GitHub Account button when GitHub is not linked', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Link GitHub Account')).toBeInTheDocument()
    })
  })

  it('shows GitHub is linked message when GitHub is linked', async () => {
    mockGetUserIdentities.mockResolvedValue({
      identities: [
        {
          id: 'identity-1',
          provider: 'email',
          identity_data: { email: 'test@example.com' },
        },
        {
          id: 'identity-2',
          provider: 'github',
          identity_data: { user_name: 'testuser' },
        },
      ],
      error: null,
    })

    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('GitHub account is linked.')).toBeInTheDocument()
    })
  })

  it('calls linkIdentity when Link GitHub Account is clicked', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Link GitHub Account')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Link GitHub Account'))

    expect(mockLinkIdentity).toHaveBeenCalledWith('github')
  })

  it('shows Unlink button when multiple identities exist', async () => {
    mockGetUserIdentities.mockResolvedValue({
      identities: [
        {
          id: 'identity-1',
          provider: 'email',
          identity_data: { email: 'test@example.com' },
        },
        {
          id: 'identity-2',
          provider: 'github',
          identity_data: { user_name: 'testuser' },
        },
      ],
      error: null,
    })

    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      const unlinkButtons = screen.getAllByText('Unlink')
      expect(unlinkButtons.length).toBeGreaterThan(0)
    })
  })

  it('shows loading state', async () => {
    mockGetUserIdentities.mockImplementation(() => new Promise(() => {}))

    render(<AccountSettings onClose={mockOnClose} />)

    expect(screen.getByText('Loading identities...')).toBeInTheDocument()
  })

  it('shows error message when loading fails', async () => {
    mockGetUserIdentities.mockResolvedValue({
      identities: [],
      error: { message: 'Failed to load' },
    })

    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument()
    })
  })

  it('displays Account Created label', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      // Check that relative time fields are present
      expect(screen.getByText('Account Created:')).toBeInTheDocument()
      expect(screen.getByText('Last Signed In:')).toBeInTheDocument()
    })
  })

  it('shows linking state when GitHub link is clicked', async () => {
    mockLinkIdentity.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Link GitHub Account')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Link GitHub Account'))

    await waitFor(() => {
      expect(screen.getByText('Linking...')).toBeInTheDocument()
    })
  })

  it('shows error when link identity fails', async () => {
    mockLinkIdentity.mockResolvedValue({ error: { message: 'Link failed' } })

    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Link GitHub Account')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Link GitHub Account'))

    await waitFor(() => {
      expect(screen.getByText('Link failed')).toBeInTheDocument()
    })
  })

  it('shows error when unlink fails', async () => {
    mockGetUserIdentities.mockResolvedValue({
      identities: [
        {
          id: 'identity-1',
          provider: 'email',
          identity_data: { email: 'test@example.com' },
        },
        {
          id: 'identity-2',
          provider: 'github',
          identity_data: { user_name: 'testuser' },
        },
      ],
      error: null,
    })
    mockUnlinkIdentity.mockResolvedValue({ error: { message: 'Unlink failed' } })

    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      const unlinkButtons = screen.getAllByText('Unlink')
      expect(unlinkButtons.length).toBeGreaterThan(0)
    })

    const unlinkButtons = screen.getAllByText('Unlink')
    fireEvent.click(unlinkButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Unlink failed')).toBeInTheDocument()
    })
  })

  it('calls unlinkIdentity when Unlink button is clicked', async () => {
    mockGetUserIdentities.mockResolvedValue({
      identities: [
        {
          id: 'identity-1',
          provider: 'email',
          identity_data: { email: 'test@example.com' },
        },
        {
          id: 'identity-2',
          provider: 'github',
          identity_data: { user_name: 'testuser' },
        },
      ],
      error: null,
    })

    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      const unlinkButtons = screen.getAllByText('Unlink')
      expect(unlinkButtons.length).toBeGreaterThan(0)
    })

    const unlinkButtons = screen.getAllByText('Unlink')
    fireEvent.click(unlinkButtons[0])

    expect(mockUnlinkIdentity).toHaveBeenCalled()
  })

  it('does not show unlink button when only one identity exists', async () => {
    // Default mock returns only one identity
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Email/Password')).toBeInTheDocument()
    })

    expect(screen.queryByText('Unlink')).not.toBeInTheDocument()
  })

  it('shows description for linking additional accounts', async () => {
    render(<AccountSettings onClose={mockOnClose} />)

    await waitFor(() => {
      expect(screen.getByText('Link Additional Accounts')).toBeInTheDocument()
    })

    expect(screen.getByText(/Link your GitHub account/)).toBeInTheDocument()
  })
})
