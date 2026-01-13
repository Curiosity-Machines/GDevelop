import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QRCodeDisplay } from '../../components/QRCodeDisplay'
import type { ProjectManifest } from '../../types'

// Mock qrcode.react
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ id, value, size }: { id: string; value: string; size: number }) => (
    <svg id={id} data-testid="qr-svg" data-value={value} data-size={size}>
      QRCode
    </svg>
  ),
}))

// Mock manifest functions
vi.mock('../../lib/manifest', () => ({
  projectToDisplayManifest: (project: ProjectManifest) => ({
    activityName: project.name,
    url: project.url,
    iconPath: project.icon,
  }),
  getManifestBaseUrl: (id: string) => `https://api.example.com/get-manifest?id=${id}`,
  getManifestApiUrl: (id: string) => `https://api.example.com/get-manifest?id=${id}&format=json`,
  getManifestPageUrl: (id: string) => `https://example.com/manifest/${id}`,
  getPublicQRPageUrl: (id: string) => `https://example.com/qr/${id}`,
}))

const mockProject: ProjectManifest = {
  id: 'test-id',
  name: 'Test Activity',
  url: 'https://example.com/app',
  icon: 'https://example.com/icon.png',
  activityConfig: {
    activityName: 'Test Activity',
    url: 'https://example.com/app',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('QRCodeDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders QR code', () => {
    render(<QRCodeDisplay project={mockProject} />)

    expect(screen.getByTestId('qr-svg')).toBeInTheDocument()
  })

  it('shows API endpoint when showDetails is true (default)', () => {
    render(<QRCodeDisplay project={mockProject} />)

    expect(screen.getByText('API Endpoint (for curl/fetch)')).toBeInTheDocument()
    // There are multiple elements with the API URL, use getAllByText
    const urlElements = screen.getAllByText(/https:\/\/api.example.com\/get-manifest/)
    expect(urlElements.length).toBeGreaterThan(0)
  })

  it('hides details when showDetails is false', () => {
    render(<QRCodeDisplay project={mockProject} showDetails={false} />)

    expect(screen.queryByText('API Endpoint (for curl/fetch)')).not.toBeInTheDocument()
  })

  it('copies API URL to clipboard', async () => {
    render(<QRCodeDisplay project={mockProject} />)

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' })
    fireEvent.click(copyButtons[0])

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://api.example.com/get-manifest?id=test-id&format=json')
    })
  })

  it('copies curl command to clipboard', async () => {
    render(<QRCodeDisplay project={mockProject} />)

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' })
    fireEvent.click(copyButtons[1])

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('curl "https://api.example.com/get-manifest?id=test-id&format=json"')
    })
  })

  it('toggles JSON view when View JSON button is clicked', () => {
    render(<QRCodeDisplay project={mockProject} />)

    expect(screen.queryByText('Activity Manifest')).not.toBeInTheDocument()

    const viewJsonButton = screen.getByText('View JSON')
    fireEvent.click(viewJsonButton)

    expect(screen.getByText('Activity Manifest')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Hide JSON'))
    expect(screen.queryByText('Activity Manifest')).not.toBeInTheDocument()
  })

  it('copies JSON when Copy button in JSON view is clicked', async () => {
    render(<QRCodeDisplay project={mockProject} />)

    // Open JSON view
    fireEvent.click(screen.getByText('View JSON'))

    // Click copy in the JSON panel
    const copyButtons = screen.getAllByRole('button', { name: 'Copy' })
    // The third copy button is in the JSON view
    fireEvent.click(copyButtons[2])

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })
  })

  it('shows manifest page link', () => {
    render(<QRCodeDisplay project={mockProject} />)

    expect(screen.getByText('View Manifest Page')).toBeInTheDocument()
    const manifestLink = screen.getByRole('link', { name: /https:\/\/example.com\/manifest/ })
    expect(manifestLink).toHaveAttribute('href', 'https://example.com/manifest/test-id')
  })

  it('shows public QR page link', () => {
    render(<QRCodeDisplay project={mockProject} />)

    expect(screen.getByText('View Public QR Page')).toBeInTheDocument()
    const qrLink = screen.getByRole('link', { name: /https:\/\/example.com\/qr/ })
    expect(qrLink).toHaveAttribute('href', 'https://example.com/qr/test-id')
  })

  it('shows Download QR button', () => {
    render(<QRCodeDisplay project={mockProject} />)

    expect(screen.getByText('Download QR')).toBeInTheDocument()
  })

  it('uses custom size prop', () => {
    render(<QRCodeDisplay project={mockProject} size={300} />)

    const qrCode = screen.getByTestId('qr-svg')
    expect(qrCode).toHaveAttribute('data-size', '300')
  })

  it('shows Copied! text after copying API URL', async () => {
    render(<QRCodeDisplay project={mockProject} />)

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' })
    fireEvent.click(copyButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })

  it('shows Copied! text after copying curl command', async () => {
    render(<QRCodeDisplay project={mockProject} />)

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' })
    fireEvent.click(copyButtons[1])

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })

  it('has Download button in JSON view', () => {
    render(<QRCodeDisplay project={mockProject} />)

    // Open JSON view
    fireEvent.click(screen.getByText('View JSON'))

    expect(screen.getByText('Download')).toBeInTheDocument()
  })

  it('shows Activity Manifest header in JSON view', () => {
    render(<QRCodeDisplay project={mockProject} />)

    // Open JSON view
    fireEvent.click(screen.getByText('View JSON'))

    expect(screen.getByText('Activity Manifest')).toBeInTheDocument()
  })

  it('displays manifest JSON in pre element', () => {
    render(<QRCodeDisplay project={mockProject} />)

    // Open JSON view
    fireEvent.click(screen.getByText('View JSON'))

    // Check JSON content is displayed
    const preElement = document.querySelector('pre')
    expect(preElement).toBeInTheDocument()
    expect(preElement?.textContent).toContain('activityName')
  })
})
