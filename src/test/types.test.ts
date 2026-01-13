import { describe, it, expect } from 'vitest'
import { defaultActivityData } from '../types'
import type { SerializableActivityData, ActivityWithRelations, ActivitySourceType, IconSourceType } from '../types'

describe('types', () => {
  describe('defaultActivityData', () => {
    it('has correct default values', () => {
      expect(defaultActivityData.activityName).toBe('New Activity')
      expect(defaultActivityData.url).toBe('')
      expect(defaultActivityData.iconPath).toBe('')
      expect(defaultActivityData.webViewResolution).toBe(1.0)
    })

    it('has required activityName field', () => {
      expect(defaultActivityData).toHaveProperty('activityName')
      expect(typeof defaultActivityData.activityName).toBe('string')
    })
  })

  describe('SerializableActivityData', () => {
    it('can be created with minimal data', () => {
      const data: SerializableActivityData = {
        activityName: 'Test Activity',
        version: 1,
      }

      expect(data.activityName).toBe('Test Activity')
      expect(data.url).toBeUndefined()
      expect(data.iconPath).toBeUndefined()
      expect(data.bundleUrl).toBeUndefined()
    })

    it('can be created with all fields', () => {
      const data: SerializableActivityData = {
        activityName: 'Full Activity',
        url: 'https://example.com',
        iconPath: 'https://example.com/icon.png',
        bundleUrl: 'https://storage.example.com/bundle.zip',
        webViewResolution: 2.0,
        version: 1,
      }

      expect(data.activityName).toBe('Full Activity')
      expect(data.url).toBe('https://example.com')
      expect(data.iconPath).toBe('https://example.com/icon.png')
      expect(data.bundleUrl).toBe('https://storage.example.com/bundle.zip')
      expect(data.webViewResolution).toBe(2.0)
    })
  })

  describe('ActivityWithRelations', () => {
    it('can be created with all required fields', () => {
      const activity: ActivityWithRelations = {
        id: 'test-id',
        name: 'Test Activity',
        version: 1,
        activityConfig: {
          activityName: 'Test Activity',
          version: 1,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      expect(activity.id).toBe('test-id')
      expect(activity.name).toBe('Test Activity')
      expect(activity.createdAt).toBeDefined()
      expect(activity.updatedAt).toBeDefined()
    })

    it('can include bundle information', () => {
      const activity: ActivityWithRelations = {
        id: 'bundle-id',
        name: 'Bundle Activity',
        bundlePath: 'user-id/activity-id',
        entryPoint: 'index.html',
        version: 1,
        activityConfig: {
          activityName: 'Bundle Activity',
          url: 'file://index.html',
          version: 1,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      expect(activity.bundlePath).toBe('user-id/activity-id')
      expect(activity.entryPoint).toBe('index.html')
    })
  })

  describe('ActivitySourceType', () => {
    it('supports url type', () => {
      const sourceType: ActivitySourceType = 'url'
      expect(sourceType).toBe('url')
    })

    it('supports bundle type', () => {
      const sourceType: ActivitySourceType = 'bundle'
      expect(sourceType).toBe('bundle')
    })
  })

  describe('IconSourceType', () => {
    it('supports url type', () => {
      const iconSource: IconSourceType = 'url'
      expect(iconSource).toBe('url')
    })

    it('supports bundle_asset type', () => {
      const iconSource: IconSourceType = 'bundle_asset'
      expect(iconSource).toBe('bundle_asset')
    })
  })
})
