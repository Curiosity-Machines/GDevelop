import { vi } from 'vitest'

// Mock data that can be controlled by tests
let needRefresh = false
const setNeedRefresh = vi.fn((value: boolean) => {
  needRefresh = value
})
const updateServiceWorker = vi.fn()

export function useRegisterSW() {
  return {
    needRefresh: [needRefresh, setNeedRefresh] as [boolean, (value: boolean) => void],
    updateServiceWorker,
    offlineReady: [false, vi.fn()] as [boolean, (value: boolean) => void],
  }
}

// Export utilities for tests to control the mock
export const __setNeedRefresh = (value: boolean) => {
  needRefresh = value
}

export const __getMockSetNeedRefresh = () => setNeedRefresh
export const __getMockUpdateServiceWorker = () => updateServiceWorker
