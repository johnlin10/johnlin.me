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
import type { Category, CreateCategoryInput } from '@/app/types/blog'

const CATEGORIES_COLLECTION = 'categories'

//* ==================== 建立分類 ====================

/**
 * 建立新分類
 * @param input 分類資料
 * @returns 新建分類的 ID
 */
export async function createCategory(
  input: CreateCategoryInput
): Promise<string> {
  try {
    const categoryData = {
      ...input,
      postCount: 0,
      createdAt: Timestamp.now(),
    }

    const docRef = await addDoc(
      collection(db, CATEGORIES_COLLECTION),
      categoryData
    )

    return docRef.id
  } catch (error) {
    console.error('建立分類失敗:', error)
    throw new Error('建立分類失敗')
  }
}

//* ==================== 讀取分類 ====================

/**
 * 根據 ID 取得分類
 * @param id 分類 ID
 * @returns 分類資料
 */
export async function getCategoryById(id: string): Promise<Category | null> {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Category
    }

    return null
  } catch (error) {
    console.error('取得分類失敗:', error)
    throw new Error('取得分類失敗')
  }
}

/**
 * 取得所有分類
 * @returns 分類列表
 */
export async function getAllCategories(): Promise<Category[]> {
  try {
    const q = query(
      collection(db, CATEGORIES_COLLECTION),
      orderBy('createdAt', 'desc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Category)
    )
  } catch (error) {
    console.error('取得分類列表失敗:', error)
    throw new Error('取得分類列表失敗')
  }
}

//* ==================== 更新分類 ====================

/**
 * 更新分類
 * @param id 分類 ID
 * @param input 更新資料
 */
export async function updateCategory(
  id: string,
  input: Partial<CreateCategoryInput>
): Promise<void> {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, id)
    await updateDoc(docRef, input)
  } catch (error) {
    console.error('更新分類失敗:', error)
    throw new Error('更新分類失敗')
  }
}

//* ==================== 刪除分類 ====================

/**
 * 刪除分類
 * @param id 分類 ID
 */
export async function deleteCategory(id: string): Promise<void> {
  try {
    const category = await getCategoryById(id)

    if (!category) {
      throw new Error('分類不存在')
    }

    if (category.postCount > 0) {
      throw new Error('無法刪除含有文章的分類')
    }

    const docRef = doc(db, CATEGORIES_COLLECTION, id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('刪除分類失敗:', error)
    throw error
  }
}

