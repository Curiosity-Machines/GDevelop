import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PWAUpdatePrompt } from '../../components/PWAUpdatePrompt'
import { __setNeedRefresh, __getMockSetNeedRefresh, __getMockUpdateServiceWorker } from '../__mocks__/pwaRegister'

describe('PWAUpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __setNeedRefresh(true) // Reset to show prompt
  })

  it('renders update prompt when needRefresh is true', () => {
    __setNeedRefresh(true)
    render(<PWAUpdatePrompt />)

    expect(screen.getByText('A new version is available!')).toBeInTheDocument()
    expect(screen.getByText('Update')).toBeInTheDocument()
  })

  it('calls updateServiceWorker when Update button is clicked', () => {
    __setNeedRefresh(true)
    render(<PWAUpdatePrompt />)

    fireEvent.click(screen.getByText('Update'))

    expect(__getMockUpdateServiceWorker()).toHaveBeenCalledWith(true)
  })

  it('calls setNeedRefresh(false) when Close button is clicked', () => {
    __setNeedRefresh(true)
    render(<PWAUpdatePrompt />)

    const closeButton = screen.getByLabelText('Close')
    fireEvent.click(closeButton)

    expect(__getMockSetNeedRefresh()).toHaveBeenCalledWith(false)
  })

  it('returns null when needRefresh is false', () => {
    __setNeedRefresh(false)
    const { container } = render(<PWAUpdatePrompt />)

    expect(container.firstChild).toBeNull()
  })
})
