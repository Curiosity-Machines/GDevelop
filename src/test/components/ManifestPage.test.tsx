import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ManifestPage } from '../../components/ManifestPage'

// Mock supabase
const mockSupabaseSelect = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockSupabaseSelect(),
        }),
      }),
    }),
  },
}))

// Mock useAuth
const mockUseAuth = vi.fn()
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// Mock qrcode.react
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ id }: { id: string }) => (
    <svg id={id} data-testid="qr-svg">
      QRCode
    </svg>
  ),
}))

// Mock manifest functions
vi.mock('../../lib/manifest', () => ({
  activityToDisplayManifest: (activity: { name: string; url?: string }) => ({
    activityName: activity.name,
    url: activity.url,
  }),
  getManifestApiUrl: (id: string) => `https://api.example.com/manifest?id=${id}&format=json`,
  getPublicQRPageUrl: (id: string) => `https://example.com/qr/${id}`,
}))

const renderManifestPage = (id: string = 'test-id') => {
  return render(
    <MemoryRouter initialEntries={[`/manifest/${id}`]}>
      <Routes>
        <Route path="/manifest/:id" element={<ManifestPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ManifestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
      loading: false,
    })
    mockSupabaseSelect.mockResolvedValue({
      data: {
        id: 'test-id',
        name: 'Test Activity',
        url: 'https://example.com/app',
        icon_url: 'https://example.com/icon.png',
        bundle_path: null,
        entry_point: null,
        webview_resolution: null,
      },
      error: null,
    })
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('shows loading state initially', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-123' },
      loading: true,
    })

    renderManifestPage()

    expect(screen.getByText('Loading manifest...')).toBeInTheDocument()
  })

  it('shows error state when activity not found', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    })

    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Activity Not Found')).toBeInTheDocument()
    })

    expect(screen.getByText('Go to Home')).toBeInTheDocument()
  })

  it('renders manifest content when activity is found', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Test Activity')).toBeInTheDocument()
    })

    expect(screen.getByText('https://example.com/app')).toBeInTheDocument()
    expect(screen.getByTestId('qr-svg')).toBeInTheDocument()
  })

  it('has Copy JSON button', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Copy JSON')).toBeInTheDocument()
    })
  })

  it('copies JSON to clipboard when Copy JSON is clicked', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Copy JSON')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Copy JSON'))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })
  })

  it('has Download button', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Download')).toBeInTheDocument()
    })
  })

  it('has Back to Studio link', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Back to Studio')).toBeInTheDocument()
    })

    const backLink = screen.getByText('Back to Studio')
    expect(backLink).toHaveAttribute('href', '/')
  })

  it('shows Scan QR Code section', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Scan QR Code')).toBeInTheDocument()
    })
  })

  it('shows Download QR Code button', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Download QR Code')).toBeInTheDocument()
    })
  })

  it('shows API Endpoint section', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('API Endpoint')).toBeInTheDocument()
    })
  })

  it('copies API URL to clipboard', async () => {
    renderManifestPage()

    await waitFor(() => {
      // There are two Copy URL buttons, use getAllByText
      const copyUrlButtons = screen.getAllByText('Copy URL')
      expect(copyUrlButtons.length).toBeGreaterThan(0)
    })

    // Get the first Copy URL button (API endpoint)
    const copyUrlButtons = screen.getAllByText('Copy URL')
    fireEvent.click(copyUrlButtons[0])

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://api.example.com/manifest?id=test-id&format=json')
    })
  })

  it('shows Public QR Page section', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Public QR Page')).toBeInTheDocument()
    })

    expect(screen.getByText('View Public QR Page')).toBeInTheDocument()
  })

  it('displays manifest JSON in pre element', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Activity Manifest')).toBeInTheDocument()
    })

    const preElement = document.querySelector('pre')
    expect(preElement).toBeInTheDocument()
    expect(preElement?.textContent).toContain('activityName')
  })

  it('copies curl command to clipboard', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Copy'))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('curl'))
    })
  })

  it('shows curl command section', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText(/curl command/i)).toBeInTheDocument()
    })
  })

  it('shows public QR URL description', async () => {
    renderManifestPage()

    await waitFor(() => {
      expect(screen.getByText(/Share this link to display the QR code publicly/)).toBeInTheDocument()
    })
  })

  it('copies public QR URL to clipboard when clicking the second Copy URL button', async () => {
    renderManifestPage()

    await waitFor(() => {
      const copyUrlButtons = screen.getAllByText('Copy URL')
      expect(copyUrlButtons.length).toBe(2)
    })

    // Click the second Copy URL button (for public QR page)
    const copyUrlButtons = screen.getAllByText('Copy URL')
    fireEvent.click(copyUrlButtons[1])

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/qr/'))
    })
  })
})
