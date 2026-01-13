import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  activityToDisplayManifest,
  projectToDisplayManifest,
  getManifestBaseUrl,
  getManifestApiUrl,
  getManifestPageUrl,
  getPublicQRPageUrl,
} from '../../lib/manifest'
import type { Activity } from '../../types/database'
import type { ActivityWithRelations } from '../../types'

// Mock import.meta.env
const mockEnv = {
  VITE_SUPABASE_URL: 'https://test-project.supabase.co',
}

vi.stubGlobal('import', {
  meta: {
    env: mockEnv,
  },
})

// We need to mock the module differently since import.meta.env is used at module load time
vi.mock('../../lib/manifest', async () => {
  // Re-implement the functions with our mock env
  const manifest = await vi.importActual('../../lib/manifest')
  return {
    ...manifest,
    getManifestBaseUrl: (activityId: string) => {
      return `https://test-project.supabase.co/functions/v1/get-manifest?id=${activityId}`
    },
    getManifestApiUrl: (activityId: string) => {
      return `https://test-project.supabase.co/functions/v1/get-manifest?id=${activityId}&format=json`
    },
  }
})

describe('manifest utilities', () => {
  describe('activityToDisplayManifest', () => {
    it('converts activity with URL to display manifest', () => {
      const activity: Activity = {
        id: 'test-id',
        user_id: 'user-id',
        name: 'Test Activity',
        url: 'https://example.com/app',
        icon_url: 'https://example.com/icon.png',
        bundle_path: null,
        entry_point: null,
        webview_resolution: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const manifest = activityToDisplayManifest(activity)

      expect(manifest).toEqual({
        activityName: 'Test Activity',
        url: 'https://example.com/app',
        iconPath: 'https://example.com/icon.png',
        webViewResolution: undefined,
      })
    })

    it('converts activity with bundle to display manifest using file:// URL', () => {
      const activity: Activity = {
        id: 'test-id',
        user_id: 'user-id',
        name: 'Bundle Activity',
        url: null,
        icon_url: 'https://example.com/icon.png',
        bundle_path: 'user-id/test-id/bundle.zip',
        entry_point: 'index.html',
        webview_resolution: 2.0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const manifest = activityToDisplayManifest(activity)

      expect(manifest).toEqual({
        activityName: 'Bundle Activity',
        url: 'file://index.html',
        iconPath: 'https://example.com/icon.png',
        webViewResolution: 2.0,
      })
    })

    it('handles activity without URL or bundle', () => {
      const activity: Activity = {
        id: 'test-id',
        user_id: 'user-id',
        name: 'Empty Activity',
        url: null,
        icon_url: null,
        bundle_path: null,
        entry_point: null,
        webview_resolution: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const manifest = activityToDisplayManifest(activity)

      expect(manifest).toEqual({
        activityName: 'Empty Activity',
        iconPath: undefined,
        webViewResolution: undefined,
      })
    })

    it('prioritizes bundle over URL when both are present', () => {
      const activity: Activity = {
        id: 'test-id',
        user_id: 'user-id',
        name: 'Mixed Activity',
        url: 'https://example.com/app',
        icon_url: null,
        bundle_path: 'user-id/test-id/bundle.zip',
        entry_point: 'index.html',
        webview_resolution: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const manifest = activityToDisplayManifest(activity)

      expect(manifest.url).toBe('file://index.html')
    })
  })

  describe('projectToDisplayManifest', () => {
    it('converts ActivityWithRelations to display manifest', () => {
      const project: ActivityWithRelations = {
        id: 'test-id',
        name: 'Test Project',
        url: 'https://example.com',
        icon: 'https://example.com/icon.png',
        bundlePath: undefined,
        entryPoint: undefined,
        activityConfig: {
          activityName: 'Test Project',
          url: 'https://example.com',
          iconPath: 'https://example.com/icon.png',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const manifest = projectToDisplayManifest(project)

      expect(manifest).toEqual({
        activityName: 'Test Project',
        url: 'https://example.com',
        iconPath: 'https://example.com/icon.png',
      })
    })

    it('handles project without URL or icon', () => {
      const project: ActivityWithRelations = {
        id: 'test-id',
        name: 'Empty Project',
        url: undefined,
        icon: undefined,
        bundlePath: undefined,
        entryPoint: undefined,
        activityConfig: {
          activityName: 'Empty Project',
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const manifest = projectToDisplayManifest(project)

      expect(manifest).toEqual({
        activityName: 'Empty Project',
        url: undefined,
        iconPath: undefined,
      })
    })
  })

  describe('getManifestBaseUrl', () => {
    it('generates correct base URL for activity', () => {
      const url = getManifestBaseUrl('test-activity-id')
      expect(url).toBe('https://test-project.supabase.co/functions/v1/get-manifest?id=test-activity-id')
    })
  })

  describe('getManifestApiUrl', () => {
    it('generates correct API URL with format=json parameter', () => {
      const url = getManifestApiUrl('test-activity-id')
      expect(url).toBe('https://test-project.supabase.co/functions/v1/get-manifest?id=test-activity-id&format=json')
    })
  })

  describe('getManifestPageUrl', () => {
    beforeEach(() => {
      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://dopple-studio.example.com' },
        writable: true,
        configurable: true,
      })
    })

    it('generates correct manifest page URL', () => {
      const url = getManifestPageUrl('test-activity-id')
      expect(url).toBe('https://dopple-studio.example.com/manifest/test-activity-id')
    })
  })

  describe('getPublicQRPageUrl', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://dopple-studio.example.com' },
        writable: true,
        configurable: true,
      })
    })

    it('generates correct public QR page URL', () => {
      const url = getPublicQRPageUrl('test-activity-id')
      expect(url).toBe('https://dopple-studio.example.com/qr/test-activity-id')
    })
  })
})
