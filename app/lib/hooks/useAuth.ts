'use client'

import { useEffect, useState } from 'react'
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth, googleProvider } from '@/app/utils/firebase'

interface UseAuthReturn {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

/**
 * 認證 Hook
 * 處理使用者登入/登出狀態
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  //* 監聽認證狀態變化
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  //* Google 登入
  const signInWithGoogle = async () => {
    try {
      setLoading(true)
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error('Google 登入失敗:', error)
      throw new Error('登入失敗')
    } finally {
      setLoading(false)
    }
  }

  //* 登出
  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
    } catch (error) {
      console.error('登出失敗:', error)
      throw new Error('登出失敗')
    }
  }

  return {
    user,
    loading,
    signInWithGoogle,
    signOut,
  }
}

