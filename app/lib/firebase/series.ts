import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/app/utils/firebase'
import type { Series, CreateSeriesInput } from '@/app/types/blog'

const SERIES_COLLECTION = 'series'

//* ==================== 建立系列 ====================

/**
 * 建立新系列
 * @param input 系列資料
 * @returns 新建系列的 ID
 */
export async function createSeries(input: CreateSeriesInput): Promise<string> {
  try {
    const seriesData = {
      ...input,
      postCount: 0,
      createdAt: Timestamp.now(),
    }

    const docRef = await addDoc(collection(db, SERIES_COLLECTION), seriesData)

    return docRef.id
  } catch (error) {
    console.error('建立系列失敗:', error)
    throw new Error('建立系列失敗')
  }
}

//* ==================== 讀取系列 ====================

/**
 * 根據 ID 取得系列
 * @param id 系列 ID
 * @returns 系列資料
 */
export async function getSeriesById(id: string): Promise<Series | null> {
  try {
    const docRef = doc(db, SERIES_COLLECTION, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Series
    }

    return null
  } catch (error) {
    console.error('取得系列失敗:', error)
    throw new Error('取得系列失敗')
  }
}

/**
 * 取得所有系列
 * @returns 系列列表
 */
export async function getAllSeries(): Promise<Series[]> {
  try {
    const q = query(
      collection(db, SERIES_COLLECTION),
      orderBy('createdAt', 'desc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Series)
    )
  } catch (error) {
    console.error('取得系列列表失敗:', error)
    throw new Error('取得系列列表失敗')
  }
}

//* ==================== 更新系列 ====================

/**
 * 更新系列
 * @param id 系列 ID
 * @param input 更新資料
 */
export async function updateSeries(
  id: string,
  input: Partial<CreateSeriesInput>
): Promise<void> {
  try {
    const docRef = doc(db, SERIES_COLLECTION, id)
    await updateDoc(docRef, input)
  } catch (error) {
    console.error('更新系列失敗:', error)
    throw new Error('更新系列失敗')
  }
}

//* ==================== 刪除系列 ====================

/**
 * 刪除系列
 * @param id 系列 ID
 */
export async function deleteSeries(id: string): Promise<void> {
  try {
    const series = await getSeriesById(id)

    if (!series) {
      throw new Error('系列不存在')
    }

    if (series.postCount > 0) {
      throw new Error('無法刪除含有文章的系列')
    }

    const docRef = doc(db, SERIES_COLLECTION, id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('刪除系列失敗:', error)
    throw error
  }
}
