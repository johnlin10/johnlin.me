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
import type { Tag, CreateTagInput } from '@/app/types/blog'

const TAGS_COLLECTION = 'tags'

//* ==================== 建立標籤 ====================

/**
 * 建立新標籤
 * @param input 標籤資料
 * @returns 新建標籤的 ID
 */
export async function createTag(input: CreateTagInput): Promise<string> {
  try {
    const tagData = {
      ...input,
      postCount: 0,
      createdAt: Timestamp.now(),
    }

    const docRef = await addDoc(collection(db, TAGS_COLLECTION), tagData)

    return docRef.id
  } catch (error) {
    console.error('建立標籤失敗:', error)
    throw new Error('建立標籤失敗')
  }
}

//* ==================== 讀取標籤 ====================

/**
 * 根據 ID 取得標籤
 * @param id 標籤 ID
 * @returns 標籤資料
 */
export async function getTagById(id: string): Promise<Tag | null> {
  try {
    const docRef = doc(db, TAGS_COLLECTION, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Tag
    }

    return null
  } catch (error) {
    console.error('取得標籤失敗:', error)
    throw new Error('取得標籤失敗')
  }
}

/**
 * 取得所有標籤
 * @returns 標籤列表
 */
export async function getAllTags(): Promise<Tag[]> {
  try {
    const q = query(
      collection(db, TAGS_COLLECTION),
      orderBy('createdAt', 'desc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Tag)
    )
  } catch (error) {
    console.error('取得標籤列表失敗:', error)
    throw new Error('取得標籤列表失敗')
  }
}

/**
 * 根據 ID 批次取得標籤
 * @param ids 標籤 ID 陣列
 * @returns 標籤列表
 */
export async function getTagsByIds(ids: string[]): Promise<Tag[]> {
  try {
    if (ids.length === 0) {
      return []
    }

    const tags = await Promise.all(ids.map((id) => getTagById(id)))
    return tags.filter((tag) => tag !== null) as Tag[]
  } catch (error) {
    console.error('批次取得標籤失敗:', error)
    throw new Error('批次取得標籤失敗')
  }
}

//* ==================== 更新標籤 ====================

/**
 * 更新標籤
 * @param id 標籤 ID
 * @param input 更新資料
 */
export async function updateTag(
  id: string,
  input: Partial<CreateTagInput>
): Promise<void> {
  try {
    const docRef = doc(db, TAGS_COLLECTION, id)
    await updateDoc(docRef, input)
  } catch (error) {
    console.error('更新標籤失敗:', error)
    throw new Error('更新標籤失敗')
  }
}

//* ==================== 刪除標籤 ====================

/**
 * 刪除標籤
 * @param id 標籤 ID
 */
export async function deleteTag(id: string): Promise<void> {
  try {
    const tag = await getTagById(id)

    if (!tag) {
      throw new Error('標籤不存在')
    }

    if (tag.postCount > 0) {
      throw new Error('無法刪除含有文章的標籤')
    }

    const docRef = doc(db, TAGS_COLLECTION, id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('刪除標籤失敗:', error)
    throw error
  }
}

