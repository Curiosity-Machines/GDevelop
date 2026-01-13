import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProjectCard } from '../../components/ProjectCard'
import type { ProjectManifest } from '../../types'

// Mock QRCodeDisplay
vi.mock('../../components/QRCodeDisplay', () => ({
  QRCodeDisplay: () => <div data-testid="qr-code-display">QRCode</div>,
}))

// Mock manifest functions
vi.mock('../../lib/manifest', () => ({
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
    webViewResolution: 2.0,
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockBundleProject: ProjectManifest = {
  id: 'bundle-id',
  name: 'Bundle Activity',
  bundlePath: 'user-id/bundle-id',
  entryPoint: 'main.html',
  activityConfig: {
    activityName: 'Bundle Activity',
    url: 'file://main.html',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('ProjectCard', () => {
  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders project name and URL', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('Test Activity')).toBeInTheDocument()
    expect(screen.getByText('https://example.com/app')).toBeInTheDocument()
  })

  it('renders WebView resolution when present', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('WebView Res: 2.00')).toBeInTheDocument()
  })

  it('renders bundle indicator for bundle projects', () => {
    render(
      <ProjectCard
        project={mockBundleProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText(/📦 Bundle/)).toBeInTheDocument()
    expect(screen.getByText('file://main.html')).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onClick={mockOnClick}
      />
    )

    const card = screen.getByText('Test Activity').closest('div')
    fireEvent.click(card!)

    expect(mockOnClick).toHaveBeenCalled()
  })

  it('calls onEdit when edit button is clicked', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    const editButton = screen.getByText('Edit')
    fireEvent.click(editButton)

    expect(mockOnEdit).toHaveBeenCalledWith(mockProject)
    expect(mockOnClick).not.toHaveBeenCalled() // Click should not propagate
  })

  it('shows confirm delete on first click', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByText('Delete')
    fireEvent.click(deleteButton)

    expect(screen.getByText('Confirm Delete?')).toBeInTheDocument()
    expect(mockOnDelete).not.toHaveBeenCalled()
  })

  it('calls onDelete on second click (confirm)', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    const deleteButton = screen.getByText('Delete')
    fireEvent.click(deleteButton) // First click - shows confirm
    fireEvent.click(screen.getByText('Confirm Delete?')) // Second click - deletes

    expect(mockOnDelete).toHaveBeenCalledWith('test-id')
  })

  it('copies QR link to clipboard when copy button is clicked', async () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    )

    const copyButton = screen.getByText('Copy QR Link')
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/qr/test-id')
    })

    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })

  it('renders QRCodeDisplay when focused', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        isFocused={true}
      />
    )

    expect(screen.getByTestId('qr-code-display')).toBeInTheDocument()
  })

  it('does not render QRCodeDisplay when not focused', () => {
    render(
      <ProjectCard
        project={mockProject}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        isFocused={false}
      />
    )

    expect(screen.queryByTestId('qr-code-display')).not.toBeInTheDocument()
  })
})
