import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PublicQRPage } from '../../components/PublicQRPage'

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
  getManifestBaseUrl: (id: string) => `https://api.example.com/manifest?id=${id}`,
}))

const renderPublicQRPage = (id: string = 'test-id') => {
  return render(
    <MemoryRouter initialEntries={[`/qr/${id}`]}>
      <Routes>
        <Route path="/qr/:id" element={<PublicQRPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PublicQRPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseSelect.mockResolvedValue({
      data: {
        name: 'Test Activity',
        icon_url: 'https://example.com/icon.png',
      },
      error: null,
    })
  })

  it('shows loading state initially', () => {
    // Don't resolve the mock
    mockSupabaseSelect.mockImplementation(() => new Promise(() => {}))

    renderPublicQRPage()

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows error state when activity not found', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    })

    renderPublicQRPage()

    await waitFor(() => {
      expect(screen.getByText('Activity Not Found')).toBeInTheDocument()
    })

    expect(screen.getByText('The requested activity could not be found.')).toBeInTheDocument()
  })

  it('renders QR code and activity name when found', async () => {
    renderPublicQRPage()

    await waitFor(() => {
      expect(screen.getByText('Test Activity')).toBeInTheDocument()
    })

    expect(screen.getByTestId('qr-svg')).toBeInTheDocument()
  })

  it('shows Made with Dopple Studio link', async () => {
    renderPublicQRPage()

    await waitFor(() => {
      expect(screen.getByText('Made with Dopple Studio')).toBeInTheDocument()
    })
  })

  it('renders without icon when icon_url is null', async () => {
    mockSupabaseSelect.mockResolvedValue({
      data: {
        name: 'Test Activity',
        icon_url: null,
      },
      error: null,
    })

    renderPublicQRPage()

    await waitFor(() => {
      expect(screen.getByText('Test Activity')).toBeInTheDocument()
    })
  })
})
