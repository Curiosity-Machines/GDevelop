import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// Simple component for testing setup verification
function TestComponent({ message }: { message: string }) {
  return <div data-testid="test-component">{message}</div>
}

describe('Vitest Setup', () => {
  it('renders a component correctly', () => {
    render(<TestComponent message="Hello, Vitest!" />)
    expect(screen.getByTestId('test-component')).toBeInTheDocument()
    expect(screen.getByText('Hello, Vitest!')).toBeInTheDocument()
  })

  it('basic assertions work', () => {
    expect(1 + 1).toBe(2)
    expect([1, 2, 3]).toHaveLength(3)
    expect({ a: 1 }).toHaveProperty('a')
  })
})
