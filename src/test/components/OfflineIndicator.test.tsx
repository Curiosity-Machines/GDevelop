import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { OfflineIndicator } from '../../components/OfflineIndicator'

describe('OfflineIndicator', () => {
  const originalNavigator = window.navigator

  beforeEach(() => {
    // Default to online
    Object.defineProperty(window, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  it('renders nothing when online', () => {
    const { container } = render(<OfflineIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('renders offline indicator when offline', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true,
      configurable: true,
    })

    render(<OfflineIndicator />)
    expect(screen.getByText("You're offline")).toBeInTheDocument()
  })

  it('shows indicator when going offline', () => {
    render(<OfflineIndicator />)
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByText("You're offline")).toBeInTheDocument()
  })

  it('hides indicator when coming back online', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true,
      configurable: true,
    })

    render(<OfflineIndicator />)
    expect(screen.getByText("You're offline")).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(screen.queryByText("You're offline")).not.toBeInTheDocument()
  })

  it('renders with the correct structure', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true,
      configurable: true,
    })

    render(<OfflineIndicator />)
    const textElement = screen.getByText("You're offline")
    // The text should be inside a container div
    expect(textElement.parentElement).toBeInTheDocument()
    // The container should have an SVG icon
    const container = textElement.parentElement
    expect(container?.querySelector('svg')).toBeInTheDocument()
  })
})
