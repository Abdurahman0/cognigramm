import { beforeEach, describe, expect, it, vi } from 'vitest'

const accessMock = vi.fn()

vi.mock('@/api/endpoints', () => ({
  filesApi: { access: (...args: unknown[]) => accessMock(...args) },
}))

const { invalidateSignedUrl, rememberSignedUrl, resolveSignedUrl } =
  await import('@/api/media-urls')

describe('signed media URLs', () => {
  beforeEach(() => {
    accessMock.mockReset()
    accessMock.mockResolvedValue({ url: 'https://s3/signed-fresh', expires_in: 900 })
  })

  it('uses the URL that came with the message instead of re-signing', async () => {
    rememberSignedUrl('key-a', 'https://s3/from-message')
    await expect(resolveSignedUrl('key-a')).resolves.toBe('https://s3/from-message')
    expect(accessMock).not.toHaveBeenCalled()
  })

  it('signs once when several elements ask for the same object at once', async () => {
    const results = await Promise.all([
      resolveSignedUrl('key-b'),
      resolveSignedUrl('key-b'),
      resolveSignedUrl('key-b'),
    ])

    expect(results).toEqual([
      'https://s3/signed-fresh',
      'https://s3/signed-fresh',
      'https://s3/signed-fresh',
    ])
    expect(accessMock).toHaveBeenCalledTimes(1)
  })

  it('re-signs after an expired lease is invalidated', async () => {
    rememberSignedUrl('key-c', 'https://s3/stale')
    invalidateSignedUrl('key-c')

    await expect(resolveSignedUrl('key-c')).resolves.toBe('https://s3/signed-fresh')
    expect(accessMock).toHaveBeenCalledWith('key-c')
  })

  it('reports an object that is gone rather than throwing at the element', async () => {
    accessMock.mockRejectedValueOnce(new Error('404'))
    await expect(resolveSignedUrl('key-d')).resolves.toBeNull()
  })
})
