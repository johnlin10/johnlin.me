'use client'

import { useEffect, useRef, useState } from 'react'
import PageContainer from '@/app/components/PageContainer/PageContainer'
import * as Tone from 'tone'
import styles from './piano.module.scss'

interface PianoKey {
  note: string
  isBlack: boolean
  midiNumber: number
}

/**
 * 生成A0到C8的所有琴鍵
 */
function generatePianoKeys(): PianoKey[] {
  const notes = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ]
  const keys: PianoKey[] = []

  // A0是第一個音符 (MIDI 21)
  // C8是最後一個音符 (MIDI 108)
  const startMidi = 21 // A0
  const endMidi = 108 // C8

  for (let midi = startMidi; midi <= endMidi; midi++) {
    const noteIndex = (midi - 12) % 12
    const octave = Math.floor((midi - 12) / 12)
    const noteName = notes[noteIndex]
    const fullNote = `${noteName}${octave}`

    keys.push({
      note: fullNote,
      isBlack: noteName.includes('#'),
      midiNumber: midi,
    })
  }

  return keys
}

export default function PianoPage() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set())
  const [sustainedNotes, setSustainedNotes] = useState<Set<string>>(new Set())
  const samplerRef = useRef<Tone.Sampler | null>(null)
  const releasePlayerRef = useRef<Tone.Player | null>(null)
  const pianoKeys = useRef<PianoKey[]>(generatePianoKeys())
  const activeNotesRef = useRef<Map<string, any>>(new Map())

  //* 滑音效果相關狀態
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartNote, setDragStartNote] = useState<string | null>(null)
  const lastDraggedNote = useRef<string | null>(null)

  useEffect(() => {
    //* 建立 Tone.js Sampler，使用現有的音檔作為基準音
    const sampler = new Tone.Sampler(
      {
        A0: '/assets/piano-sample/A0v8.ogg',
        A1: '/assets/piano-sample/A1v8.ogg',
        A2: '/assets/piano-sample/A2v8.ogg',
        A3: '/assets/piano-sample/A3v8.ogg',
        A4: '/assets/piano-sample/A4v8.ogg',
        A5: '/assets/piano-sample/A5v8.ogg',
        A6: '/assets/piano-sample/A6v8.ogg',
        A7: '/assets/piano-sample/A7v8.ogg',
        C1: '/assets/piano-sample/C1v8.ogg',
        C2: '/assets/piano-sample/C2v8.ogg',
        C3: '/assets/piano-sample/C3v8.ogg',
        C4: '/assets/piano-sample/C4v8.ogg',
        C5: '/assets/piano-sample/C5v8.ogg',
        C6: '/assets/piano-sample/C6v8.ogg',
        C7: '/assets/piano-sample/C7v8.ogg',
        C8: '/assets/piano-sample/C8v8.ogg',
        'D#1': '/assets/piano-sample/D%231v8.ogg',
        'D#2': '/assets/piano-sample/D%232v8.ogg',
        'D#3': '/assets/piano-sample/D%233v8.ogg',
        'D#4': '/assets/piano-sample/D%234v8.ogg',
        'D#5': '/assets/piano-sample/D%235v8.ogg',
        'D#6': '/assets/piano-sample/D%236v8.ogg',
        'D#7': '/assets/piano-sample/D%237v8.ogg',
        'F#1': '/assets/piano-sample/F%231v8.ogg',
        'F#2': '/assets/piano-sample/F%232v8.ogg',
        'F#3': '/assets/piano-sample/F%233v8.ogg',
        'F#4': '/assets/piano-sample/F%234v8.ogg',
        'F#5': '/assets/piano-sample/F%235v8.ogg',
        'F#6': '/assets/piano-sample/F%236v8.ogg',
        'F#7': '/assets/piano-sample/F%237v8.ogg',
      },
      {
        onload: () => {
          console.log('Piano samples loaded')
          setIsLoaded(true)
        },
        onerror: (error) => {
          console.error('Error loading piano samples:', error)
        },
      }
    ).toDestination()

    samplerRef.current = sampler

    //* 載入琴鍵歸位聲效
    const releasePlayer = new Tone.Player({
      url: '/assets/piano-sample/rel.ogg',
      volume: -25,
      onload: () => {
        console.log('Release sound loaded')
      },
      onerror: (error) => {
        console.error('Error loading release sound:', error)
      },
    }).toDestination()

    releasePlayerRef.current = releasePlayer

    return () => {
      sampler.dispose()
      releasePlayer.dispose()
    }
  }, [])

  //* 鍵盤事件監聽器
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isLoaded])

  //* 全域滑鼠事件監聽器（用於滑音效果）
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        setDragStartNote(null)
        lastDraggedNote.current = null

        // 停止所有拖拽相關的音符
        sustainedNotes.forEach((note) => {
          stopNote(note)
        })
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging, sustainedNotes])

  /**
   * 開始播放音符（按住）
   */
  const startNote = async (note: string) => {
    if (!samplerRef.current || !isLoaded || activeNotesRef.current.has(note))
      return

    // 確保 AudioContext 已啟動
    if (Tone.context.state !== 'running') {
      await Tone.start()
    }

    // 觸發音符開始播放
    const noteInstance = samplerRef.current.triggerAttack(note)
    activeNotesRef.current.set(note, noteInstance)

    // 視覺反饋
    setActiveKeys((prev) => new Set(prev).add(note))
    setSustainedNotes((prev) => new Set(prev).add(note))
  }

  /**
   * 播放琴鍵歸位聲
   */
  const playReleaseSound = () => {
    if (!releasePlayerRef.current) return

    try {
      // 重新開始播放（如果已經在播放中）
      if (releasePlayerRef.current.state === 'started') {
        releasePlayerRef.current.restart()
      } else {
        releasePlayerRef.current.start()
      }
    } catch (error) {
      console.error('Error playing release sound:', error)
    }
  }

  /**
   * 停止播放音符（放開）
   */
  const stopNote = (note: string) => {
    if (!samplerRef.current || !activeNotesRef.current.has(note)) return

    // 播放琴鍵歸位聲
    playReleaseSound()
    // 停止音符播放
    samplerRef.current.triggerRelease(note)
    activeNotesRef.current.delete(note)

    // 移除視覺反饋
    setActiveKeys((prev) => {
      const newSet = new Set(prev)
      newSet.delete(note)
      return newSet
    })
    setSustainedNotes((prev) => {
      const newSet = new Set(prev)
      newSet.delete(note)
      return newSet
    })
  }

  //* 鍵盤映射 E4-F5 (一個八度)
  const keyboardMapping = useRef<Map<string, string>>(
    new Map([
      // 白鍵映射
      ['KeyA', 'E4'], // A -> E4
      ['KeyS', 'F4'], // S -> F4
      ['KeyD', 'G4'], // D -> G4
      ['KeyF', 'A4'], // F -> A4
      ['KeyG', 'B4'], // G -> B4
      ['KeyH', 'C5'], // H -> C5
      ['KeyJ', 'D5'], // J -> D5
      ['KeyK', 'E5'], // K -> E5
      ['KeyL', 'F5'], // L -> F5
      ['Semicolon', 'G5'], // ; -> G5
      // 黑鍵映射
      ['KeyE', 'F#4'], // E -> F#4
      ['KeyR', 'G#4'], // R -> G#4
      ['KeyT', 'A#4'], // T -> A#4
      ['KeyU', 'C#5'], // U -> C#5
      ['KeyI', 'D#5'], // I -> D#5
      ['KeyP', 'F#5'], // O -> F#5
    ])
  )

  const pressedKeys = useRef<Set<string>>(new Set())

  /**
   * 處理鍵盤按下
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    if (pressedKeys.current.has(event.code)) return // 防止重複觸發

    const note = keyboardMapping.current.get(event.code)
    if (note) {
      event.preventDefault()
      pressedKeys.current.add(event.code)
      startNote(note)
    }
  }

  /**
   * 處理鍵盤放開
   */
  const handleKeyUp = (event: KeyboardEvent) => {
    const note = keyboardMapping.current.get(event.code)
    if (note && pressedKeys.current.has(event.code)) {
      event.preventDefault()
      pressedKeys.current.delete(event.code)
      stopNote(note)
    }
  }

  /**
   * 處理滑鼠按下
   */
  const handleMouseDown = (note: string) => {
    setIsDragging(true)
    setDragStartNote(note)
    lastDraggedNote.current = note
    startNote(note)
  }

  /**
   * 處理滑鼠放開
   */
  const handleMouseUp = (note: string) => {
    if (!isDragging) {
      stopNote(note)
    }
  }

  /**
   * 處理滑鼠進入琴鍵（滑音效果）
   */
  const handleMouseEnter = (note: string) => {
    if (isDragging && lastDraggedNote.current !== note) {
      // 停止上一個音符
      if (lastDraggedNote.current) {
        stopNote(lastDraggedNote.current)
      }

      // 開始新音符
      startNote(note)
      lastDraggedNote.current = note
    }
  }

  /**
   * 處理滑鼠離開琴鍵
   */
  const handleMouseLeave = (note: string) => {
    // 只有在非拖拽狀態下才停止音符
    if (!isDragging) {
      stopNote(note)
    }
  }

  /**
   * 渲染白鍵
   */
  const renderWhiteKeys = () => {
    return pianoKeys.current
      .filter((key) => !key.isBlack)
      .map((key, index) => (
        <div
          key={`white-${key.note}`}
          className={`${styles.white_key} ${
            activeKeys.has(key.note) ? styles.active : ''
          }`}
          onMouseDown={() => handleMouseDown(key.note)}
          onMouseUp={() => handleMouseUp(key.note)}
          onMouseEnter={() => handleMouseEnter(key.note)}
          onMouseLeave={() => handleMouseLeave(key.note)}
          onTouchStart={(e) => {
            e.preventDefault()
            handleMouseDown(key.note)
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            handleMouseUp(key.note)
          }}
        >
          <span className={styles.key_label}>{key.note}</span>
        </div>
      ))
  }

  /**
   * 渲染黑鍵
   */
  const renderBlackKeys = () => {
    const blackKeys = pianoKeys.current.filter((key) => key.isBlack)

    return blackKeys.map((key, index) => {
      // 計算該黑鍵之前有多少個白鍵
      const currentKeyIndex = pianoKeys.current.findIndex(
        (k) => k.note === key.note
      )
      const whiteKeysBeforeThis = pianoKeys.current
        .slice(0, currentKeyIndex)
        .filter((k) => !k.isBlack).length

      // 黑鍵應該位於前一個白鍵的右側
      // 白鍵寬度 60px，黑鍵寬度 36px
      // 黑鍵應該從前一個白鍵的中間偏右開始
      const leftPosition = whiteKeysBeforeThis * 60 - 16

      return (
        <div
          key={`black-${key.note}`}
          className={`${styles.black_key} ${
            activeKeys.has(key.note) ? styles.active : ''
          }`}
          style={{
            left: `${leftPosition}px`,
          }}
          onMouseDown={() => handleMouseDown(key.note)}
          onMouseUp={() => handleMouseUp(key.note)}
          onMouseEnter={() => handleMouseEnter(key.note)}
          onMouseLeave={() => handleMouseLeave(key.note)}
          onTouchStart={(e) => {
            e.preventDefault()
            handleMouseDown(key.note)
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            handleMouseUp(key.note)
          }}
        >
          <span className={styles.key_label}>{key.note}</span>
        </div>
      )
    })
  }

  return (
    <PageContainer maxWidth="max-content">
      <div className={styles.piano_header}>
        <h1>鋼琴</h1>
        <div className={styles.description}></div>
      </div>

      <div className={styles.piano_container}>
        <div className={styles.piano_scroll}>
          <div className={styles.piano}>
            <div className={styles.white_keys}>{renderWhiteKeys()}</div>
            <div className={styles.black_keys}>{renderBlackKeys()}</div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
