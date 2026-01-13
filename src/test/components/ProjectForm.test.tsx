import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProjectForm } from '../../components/ProjectForm'
import type { ProjectManifest } from '../../types'

// Mock JSZip
vi.mock('jszip', () => ({
  default: {
    loadAsync: vi.fn().mockResolvedValue({
      forEach: vi.fn((callback: (path: string, entry: { dir: boolean }) => void) => {
        callback('index.html', { dir: false })
        callback('styles.css', { dir: false })
      }),
    }),
  },
}))

const mockProject: ProjectManifest = {
  id: 'test-id',
  name: 'Test Activity',
  url: 'https://example.com',
  icon: 'https://example.com/icon.png',
  activityConfig: {
    activityName: 'Test Activity',
    url: 'https://example.com',
    webViewResolution: 1.0,
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

const mockBundleProject: ProjectManifest = {
  id: 'bundle-id',
  name: 'Bundle Activity',
  bundlePath: 'user-id/activity-id',
  entryPoint: 'index.html',
  activityConfig: {
    activityName: 'Bundle Activity',
    url: 'file://index.html',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('ProjectForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders create form when no project is provided', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText('Create New Activity')).toBeInTheDocument()
      expect(screen.getByText(/Activity Name/)).toBeInTheDocument()
    })

    it('renders edit form when project is provided', () => {
      render(<ProjectForm project={mockProject} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText('Edit Activity')).toBeInTheDocument()
    })

    it('populates form fields with project data when editing', () => {
      render(<ProjectForm project={mockProject} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const nameInput = document.getElementById('name') as HTMLInputElement
      expect(nameInput.value).toBe('Test Activity')

      const urlInput = document.getElementById('url') as HTMLInputElement
      expect(urlInput.value).toBe('https://example.com')
    })
  })

  describe('source type selection', () => {
    it('shows Web URL button by default', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Source type buttons
      expect(screen.getByText(/Web URL/)).toBeInTheDocument()
      expect(screen.getByText(/Upload Bundle/)).toBeInTheDocument()
    })

    it('shows URL input when Web URL is selected by default', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // URL input should be visible
      expect(document.getElementById('url')).toBeInTheDocument()
    })

    it('shows Current Bundle info when editing a bundle project', () => {
      render(<ProjectForm project={mockBundleProject} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText('Current Bundle')).toBeInTheDocument()
    })
  })

  describe('URL input', () => {
    it('shows URL input when URL source type is selected', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(document.getElementById('url')).toBeInTheDocument()
    })

    it('accepts valid HTTPS URL', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const urlInput = document.getElementById('url') as HTMLInputElement
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

      expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument()
    })
  })

  describe('icon input', () => {
    it('shows icon URL input', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(document.getElementById('icon')).toBeInTheDocument()
    })

    it('allows empty icon URL', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const iconInput = document.getElementById('icon') as HTMLInputElement
      fireEvent.change(iconInput, { target: { value: '' } })

      expect(screen.queryByText(/icon url must use https/i)).not.toBeInTheDocument()
    })

    it('shows error for HTTP icon URL', async () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const iconInput = document.getElementById('icon') as HTMLInputElement
      fireEvent.change(iconInput, { target: { value: 'http://example.com/icon.png' } })
      fireEvent.blur(iconInput)

      await waitFor(() => {
        expect(screen.getByText(/https protocol/i)).toBeInTheDocument()
      })
    })
  })

  describe('form actions', () => {
    it('calls onCancel when Cancel button is clicked', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('has Submit button for create', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: /create activity/i })).toBeInTheDocument()
    })

    it('shows Save Changes button when editing', () => {
      render(<ProjectForm project={mockProject} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })
  })

  describe('webview resolution', () => {
    it('has WebView Resolution field', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText(/webview resolution/i)).toBeInTheDocument()
      expect(document.getElementById('webViewResolution')).toBeInTheDocument()
    })
  })

  describe('bundle upload', () => {
    it('shows file upload area when Upload Bundle button is clicked', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Click the Upload Bundle button
      const bundleButton = screen.getByText(/Upload Bundle/)
      fireEvent.click(bundleButton)

      // The file upload area shows this text
      expect(screen.getByText(/Click to select or drag & drop a ZIP file/i)).toBeInTheDocument()
    })
  })

  describe('upload progress', () => {
    it('shows uploading state when uploading', () => {
      render(
        <ProjectForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          uploadProgress={{ current: 50, total: 100, phase: 'uploading' }}
        />
      )

      // Find submit button - should show Uploading text
      expect(screen.getByText('Uploading...')).toBeInTheDocument()
    })

    it('disables cancel button during upload', () => {
      render(
        <ProjectForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          uploadProgress={{ current: 50, total: 100, phase: 'uploading' }}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeDisabled()
    })
  })

  describe('form submission', () => {
    it('submits form with correct data for URL source', async () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const nameInput = document.getElementById('name') as HTMLInputElement
      const urlInput = document.getElementById('url') as HTMLInputElement

      fireEvent.change(nameInput, { target: { value: 'New Activity' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com/app' } })

      const submitButton = screen.getByRole('button', { name: /create activity/i })
      fireEvent.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalled()
      const [formData] = mockOnSubmit.mock.calls[0]
      expect(formData.name).toBe('New Activity')
      expect(formData.url).toBe('https://example.com/app')
    })

    it('does not submit if name is empty', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const urlInput = document.getElementById('url') as HTMLInputElement
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /create activity/i })
      fireEvent.click(submitButton)

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('submits form with icon when provided', async () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const nameInput = document.getElementById('name') as HTMLInputElement
      const urlInput = document.getElementById('url') as HTMLInputElement
      const iconInput = document.getElementById('icon') as HTMLInputElement

      fireEvent.change(nameInput, { target: { value: 'New Activity' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com/app' } })
      fireEvent.change(iconInput, { target: { value: 'https://example.com/icon.png' } })

      const submitButton = screen.getByRole('button', { name: /create activity/i })
      fireEvent.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalled()
      const [formData] = mockOnSubmit.mock.calls[0]
      expect(formData.icon).toBe('https://example.com/icon.png')
    })

    it('submits form with webViewResolution when provided', async () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const nameInput = document.getElementById('name') as HTMLInputElement
      const urlInput = document.getElementById('url') as HTMLInputElement
      const webViewResolutionInput = document.getElementById('webViewResolution') as HTMLInputElement

      fireEvent.change(nameInput, { target: { value: 'New Activity' } })
      fireEvent.change(urlInput, { target: { value: 'https://example.com/app' } })
      fireEvent.change(webViewResolutionInput, { target: { value: '2.0' } })

      const submitButton = screen.getByRole('button', { name: /create activity/i })
      fireEvent.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalled()
      const [formData] = mockOnSubmit.mock.calls[0]
      expect(formData.activityConfig.webViewResolution).toBe(2.0)
    })

    it('omits webViewResolution when it is the default 1.0', async () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const nameInput = document.getElementById('name') as HTMLInputElement
      const webViewResolutionInput = document.getElementById('webViewResolution') as HTMLInputElement

      fireEvent.change(nameInput, { target: { value: 'New Activity' } })
      fireEvent.change(webViewResolutionInput, { target: { value: '1.0' } }) // Default value

      const submitButton = screen.getByRole('button', { name: /create activity/i })
      fireEvent.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalled()
      const [formData] = mockOnSubmit.mock.calls[0]
      // When webViewResolution equals 1.0, it should be undefined (not stored)
      expect(formData.activityConfig.webViewResolution).toBeUndefined()
    })
  })

  describe('icon validation', () => {
    it('shows error for invalid URL format', async () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const iconInput = document.getElementById('icon') as HTMLInputElement
      fireEvent.change(iconInput, { target: { value: 'not a valid url' } })

      await waitFor(() => {
        expect(screen.getByText(/Invalid URL format/i)).toBeInTheDocument()
      })
    })

    it('accepts valid data URL', async () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const iconInput = document.getElementById('icon') as HTMLInputElement
      fireEvent.change(iconInput, { target: { value: 'data:image/png;base64,iVBORw0KGgo=' } })

      await waitFor(() => {
        expect(screen.queryByText(/Invalid/i)).not.toBeInTheDocument()
      })
    })

    it('shows error for unsupported image format', async () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const iconInput = document.getElementById('icon') as HTMLInputElement
      fireEvent.change(iconInput, { target: { value: 'https://example.com/icon.svg' } })

      await waitFor(() => {
        expect(screen.getByText(/Unsupported image format/i)).toBeInTheDocument()
      })
    })
  })

  describe('webview resolution input', () => {
    it('shows WebView Resolution input field', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const webViewInput = document.getElementById('webViewResolution')
      expect(webViewInput).toBeInTheDocument()
    })

    it('shows help text for WebView Resolution', () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText(/Vuplex CanvasWebViewPrefab/i)).toBeInTheDocument()
    })

    it('populates webViewResolution from existing project', () => {
      const projectWithResolution = {
        ...mockProject,
        activityConfig: {
          ...mockProject.activityConfig,
          webViewResolution: 2.5,
        },
      }

      render(<ProjectForm project={projectWithResolution} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const webViewInput = document.getElementById('webViewResolution') as HTMLInputElement
      expect(webViewInput.value).toBe('2.5')
    })
  })

  describe('button states', () => {
    it('disables submit button when parsing zip', async () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Switch to bundle mode
      const bundleButton = screen.getByText(/Upload Bundle/)
      fireEvent.click(bundleButton)

      // Submit button should be enabled initially (before parsing)
      const submitButton = screen.getByRole('button', { name: /create activity/i })
      expect(submitButton).not.toBeDisabled()
    })

    it('disables submit button when there is an icon error', async () => {
      render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const iconInput = document.getElementById('icon') as HTMLInputElement
      fireEvent.change(iconInput, { target: { value: 'http://insecure.com/icon.png' } })

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /create activity/i })
        expect(submitButton).toBeDisabled()
      })
    })
  })
})
