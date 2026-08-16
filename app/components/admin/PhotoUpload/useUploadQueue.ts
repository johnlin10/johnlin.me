'use client'

import { useCallback, useRef, useState } from 'react'
import type { Photo } from '@/app/types/photo'
import { uploadPhoto } from './uploadPhoto'
import type { StagedPhoto } from './stagedPhoto'

/**
 * 同時上傳幾張。兩個 42 MB 的 PUT 已經吃掉一般上傳頻寬的大半，
 * 更高的並發只會讓每一條都變慢，而且會同時佔用更多 sharp 處理程序。
 */
const CONCURRENCY = 2

type Patch = Partial<
  Pick<StagedPhoto, 'status' | 'progress' | 'error'>
>

export interface UseUploadQueueOptions {
  photosRef: React.RefObject<StagedPhoto[]>
  takenAtLocalOf: (photo: StagedPhoto) => string
  takenAtOf: (photo: StagedPhoto) => string
  onPatch: (localId: string, patch: Patch) => void
  onDone: (localId: string, photo: Photo) => void
}

/**
 * 並發驅動器，不含任何 UI。維護一個游標而不是 Promise.all(map(...))，
 * 這樣佇列裡的張數不受並發數限制，且任一張失敗不會拖垮其他張的排程。
 */
export function useUploadQueue({
  photosRef,
  takenAtLocalOf,
  takenAtOf,
  onPatch,
  onDone,
}: UseUploadQueueOptions) {
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(
    async (localIds: string[]) => {
      setRunning(true)
      const controller = new AbortController()
      abortRef.current = controller
      let cursor = 0

      const worker = async () => {
        while (cursor < localIds.length) {
          const localId = localIds[cursor++]
          const photo = photosRef.current.find((p) => p.localId === localId)
          if (!photo) continue

          onPatch(localId, { status: 'uploading', progress: 0, error: undefined })
          try {
            const result = await uploadPhoto(
              photo,
              takenAtLocalOf(photo),
              takenAtOf(photo),
              {
                onProgress: (progress) => onPatch(localId, { progress }),
                onStatusChange: (status) => onPatch(localId, { status }),
              },
              controller.signal
            )
            onPatch(localId, { status: 'done', progress: 1 })
            onDone(localId, result)
          } catch (error) {
            onPatch(localId, {
              status: 'error',
              error: error instanceof Error ? error.message : '上傳失敗',
            })
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, localIds.length) }, worker)
      )
      abortRef.current = null
      setRunning(false)
    },
    [photosRef, takenAtLocalOf, takenAtOf, onPatch, onDone]
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { run, cancel, running }
}
