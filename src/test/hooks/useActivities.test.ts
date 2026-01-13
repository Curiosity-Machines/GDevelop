import { describe, it, expect } from 'vitest'
import { getBundleDownloadUrl, getIconDownloadUrl } from '../../hooks/useActivities'

// We test the exported utility functions since the hook depends heavily on supabase
// and is difficult to test in isolation due to complex dependency arrays in useCallback

describe('useActivities utilities', () => {
  describe('getBundleDownloadUrl', () => {
    it('generates correct bundle download URL', () => {
      const bundlePath = 'user-123/activity-456'
      const url = getBundleDownloadUrl(bundlePath)

      // Test URL structure rather than exact URL (env var may differ)
      expect(url).toContain('/storage/v1/object/public/activity-bundles/')
      expect(url).toContain('user-123/activity-456/bundle.zip')
    })

    it('handles paths with special characters', () => {
      const bundlePath = 'user-abc/activity-xyz-123'
      const url = getBundleDownloadUrl(bundlePath)

      expect(url).toContain('user-abc/activity-xyz-123')
    })

    it('handles paths with multiple segments', () => {
      const bundlePath = 'uuid-12345/activity-uuid-67890'
      const url = getBundleDownloadUrl(bundlePath)

      expect(url).toContain('uuid-12345/activity-uuid-67890/bundle.zip')
    })

    it('generates URL with correct structure', () => {
      const bundlePath = 'test-user/test-activity'
      const url = getBundleDownloadUrl(bundlePath)

      // URL should end with the bundle.zip
      expect(url.endsWith('/bundle.zip')).toBe(true)
    })
  })

  describe('getIconDownloadUrl', () => {
    it('generates correct icon download URL', () => {
      const bundlePath = 'user-123/activity-456'
      const iconFileName = 'icon.png'
      const url = getIconDownloadUrl(bundlePath, iconFileName)

      // Test URL structure rather than exact URL (env var may differ)
      expect(url).toContain('/storage/v1/object/public/activity-bundles/')
      expect(url).toContain('user-123/activity-456/icon.png')
    })

    it('handles different icon extensions', () => {
      const bundlePath = 'user-123/activity-456'

      const pngUrl = getIconDownloadUrl(bundlePath, 'icon.png')
      expect(pngUrl).toContain('icon.png')

      const jpgUrl = getIconDownloadUrl(bundlePath, 'icon.jpg')
      expect(jpgUrl).toContain('icon.jpg')

      const webpUrl = getIconDownloadUrl(bundlePath, 'icon.webp')
      expect(webpUrl).toContain('icon.webp')

      const bmpUrl = getIconDownloadUrl(bundlePath, 'icon.bmp')
      expect(bmpUrl).toContain('icon.bmp')

      const tgaUrl = getIconDownloadUrl(bundlePath, 'icon.tga')
      expect(tgaUrl).toContain('icon.tga')
    })

    it('handles icon filenames with different casing', () => {
      const bundlePath = 'user-123/activity-456'

      const upperUrl = getIconDownloadUrl(bundlePath, 'ICON.PNG')
      expect(upperUrl).toContain('ICON.PNG')

      const mixedUrl = getIconDownloadUrl(bundlePath, 'Icon.Png')
      expect(mixedUrl).toContain('Icon.Png')
    })

    it('generates URL with icon filename at the end', () => {
      const bundlePath = 'test-user/test-activity'
      const iconFileName = 'my-icon.jpg'
      const url = getIconDownloadUrl(bundlePath, iconFileName)

      expect(url.endsWith('/' + iconFileName)).toBe(true)
    })

    it('handles special characters in icon filename', () => {
      const bundlePath = 'user-123/activity-456'
      const iconFileName = 'my_icon-v2.png'
      const url = getIconDownloadUrl(bundlePath, iconFileName)

      expect(url).toContain('my_icon-v2.png')
    })
  })
})
