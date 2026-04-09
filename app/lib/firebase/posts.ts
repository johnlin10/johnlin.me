import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  increment,
} from 'firebase/firestore'
import { db } from '@/app/utils/firebase'
import type {
  Post,
  CreatePostInput,
  UpdatePostInput,
  PostQueryParams,
  QueryResult,
} from '@/app/types/blog'

const POSTS_COLLECTION = 'posts'

//* ==================== 建立文章 ====================

/**
 * 建立新文章
 * @param input 文章資料
 * @returns 新建文章的 ID
 */
export async function createPost(input: CreatePostInput): Promise<string> {
  try {
    const postData = {
      ...input,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      publishedAt: input.status === 'published' ? Timestamp.now() : null,
      viewCount: 0,
    }

    const docRef = await addDoc(collection(db, POSTS_COLLECTION), postData)

    // 更新分類的文章數量
    if (input.categoryId) {
      await updateCategoryPostCount(input.categoryId, 1)
    }

    // 更新標籤的文章數量
    if (input.tagIds && input.tagIds.length > 0) {
      await Promise.all(
        input.tagIds.map((tagId) => updateTagPostCount(tagId, 1))
      )
    }

    // 更新系列的文章數量
    if (input.seriesId) {
      await updateSeriesPostCount(input.seriesId, 1)
    }

    return docRef.id
  } catch (error) {
    console.error('建立文章失敗:', error)
    throw new Error('建立文章失敗')
  }
}

//* ==================== 讀取文章 ====================

/**
 * 根據 ID 取得文章
 * @param id 文章 ID
 * @returns 文章資料
 */
export async function getPostById(id: string): Promise<Post | null> {
  try {
    const docRef = doc(db, POSTS_COLLECTION, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Post
    }

    return null
  } catch (error) {
    console.error('取得文章失敗:', error)
    throw new Error('取得文章失敗')
  }
}

/**
 * 根據 slug 取得文章
 * @param slug 文章 slug
 * @returns 文章資料
 */
export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const q = query(
      collection(db, POSTS_COLLECTION),
      where('slug', '==', slug),
      limit(1)
    )

    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return null
    }

    const docSnap = querySnapshot.docs[0]
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Post
  } catch (error) {
    console.error('取得文章失敗:', error)
    throw new Error('取得文章失敗')
  }
}

/**
 * 查詢文章列表
 * @param params 查詢參數
 * @returns 文章列表與分頁資訊
 */
export async function getPosts(
  params: PostQueryParams = {}
): Promise<QueryResult<Post>> {
  try {
    const {
      page = 1,
      pageSize = 10,
      status,
      categoryId,
      tagId,
      seriesId,
    } = params

    // 建立基礎查詢
    let q = query(
      collection(db, POSTS_COLLECTION),
      orderBy('createdAt', 'desc')
    )

    // 如果有 where 條件，需要先建立索引
    // 暫時先取得所有資料，然後在客戶端篩選
    const querySnapshot = await getDocs(q)

    let allPosts: Post[] = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Post)
    )

    // 在客戶端進行篩選
    if (status) {
      allPosts = allPosts.filter((post) => post.status === status)
    }
    if (categoryId) {
      allPosts = allPosts.filter((post) => post.categoryId === categoryId)
    }
    if (tagId) {
      allPosts = allPosts.filter((post) => post.tagIds.includes(tagId))
    }
    if (seriesId) {
      allPosts = allPosts.filter((post) => post.seriesId === seriesId)
    }

    // 分頁處理
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedPosts = allPosts.slice(startIndex, endIndex)
    const hasMore = allPosts.length > endIndex

    return {
      data: paginatedPosts,
      total: allPosts.length,
      page,
      pageSize,
      hasMore,
    }
  } catch (error: any) {
    console.error('查詢文章失敗 - 詳細錯誤:', error)
    console.error('錯誤訊息:', error?.message)
    console.error('錯誤代碼:', error?.code)
    console.error('完整錯誤:', JSON.stringify(error, null, 2))
    throw error
  }
}

/**
 * 取得系列中的所有文章
 * @param seriesId 系列 ID
 * @returns 文章列表（按 seriesOrder 排序）
 */
export async function getPostsBySeries(seriesId: string): Promise<Post[]> {
  try {
    // 先取得該系列的所有文章
    const q = query(
      collection(db, POSTS_COLLECTION),
      where('seriesId', '==', seriesId)
    )

    const querySnapshot = await getDocs(q)
    const allPosts = querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Post)
    )

    // 在客戶端篩選已發布的文章並排序
    return allPosts
      .filter((post) => post.status === 'published')
      .sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0))
  } catch (error) {
    console.error('取得系列文章失敗:', error)
    throw new Error('取得系列文章失敗')
  }
}

//* ==================== 更新文章 ====================

/**
 * 更新文章
 * @param input 更新資料
 */
export async function updatePost(input: UpdatePostInput): Promise<void> {
  try {
    const { id, ...updateData } = input
    const docRef = doc(db, POSTS_COLLECTION, id)

    // 如果狀態變更為 published，更新 publishedAt
    if (updateData.status === 'published') {
      const currentPost = await getPostById(id)
      if (currentPost && currentPost.status === 'draft') {
        updateData.publishedAt = Timestamp.now()
      }
    }

    await updateDoc(docRef, {
      ...updateData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('更新文章失敗:', error)
    throw new Error('更新文章失敗')
  }
}

/**
 * 增加文章瀏覽次數
 * @param id 文章 ID
 */
export async function incrementPostViewCount(id: string): Promise<void> {
  try {
    const docRef = doc(db, POSTS_COLLECTION, id)
    await updateDoc(docRef, {
      viewCount: increment(1),
    })
  } catch (error) {
    console.error('更新瀏覽次數失敗:', error)
  }
}

//* ==================== 刪除文章 ====================

/**
 * 刪除文章
 * @param id 文章 ID
 */
export async function deletePost(id: string): Promise<void> {
  try {
    const post = await getPostById(id)
    if (!post) {
      throw new Error('文章不存在')
    }

    // 更新分類的文章數量
    if (post.categoryId) {
      await updateCategoryPostCount(post.categoryId, -1)
    }

    // 更新標籤的文章數量
    if (post.tagIds && post.tagIds.length > 0) {
      await Promise.all(
        post.tagIds.map((tagId) => updateTagPostCount(tagId, -1))
      )
    }

    // 更新系列的文章數量
    if (post.seriesId) {
      await updateSeriesPostCount(post.seriesId, -1)
    }

    const docRef = doc(db, POSTS_COLLECTION, id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error('刪除文章失敗:', error)
    throw new Error('刪除文章失敗')
  }
}

//* ==================== 輔助函數 ====================

async function updateCategoryPostCount(
  categoryId: string,
  change: number
): Promise<void> {
  const docRef = doc(db, 'categories', categoryId)
  await updateDoc(docRef, {
    postCount: increment(change),
  })
}

async function updateTagPostCount(
  tagId: string,
  change: number
): Promise<void> {
  const docRef = doc(db, 'tags', tagId)
  await updateDoc(docRef, {
    postCount: increment(change),
  })
}

async function updateSeriesPostCount(
  seriesId: string,
  change: number
): Promise<void> {
  const docRef = doc(db, 'series', seriesId)
  await updateDoc(docRef, {
    postCount: increment(change),
  })
}

/**
 * 檢查 slug 是否已存在
 * @param slug 要檢查的 slug
 * @param excludeId 排除的文章 ID（編輯時使用）
 * @returns 是否已存在
 */
export async function isSlugExists(
  slug: string,
  excludeId?: string
): Promise<boolean> {
  try {
    const q = query(
      collection(db, POSTS_COLLECTION),
      where('slug', '==', slug),
      limit(1)
    )

    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return false
    }

    if (excludeId) {
      const docId = querySnapshot.docs[0].id
      return docId !== excludeId
    }

    return true
  } catch (error) {
    console.error('檢查 slug 失敗:', error)
    throw new Error('檢查 slug 失敗')
  }
}
