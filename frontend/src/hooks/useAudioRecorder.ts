'use client'

import { useState, useRef, useCallback } from 'react'

interface AudioRecorderHook {
  isRecording: boolean
  audioBlob: Blob | null
  audioUrl: string | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  error: string | null
}

export function useAudioRecorder(): AudioRecorderHook {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  
  const startRecording = useCallback(async () => {
    audioChunksRef.current = []
    setAudioBlob(null)
    setAudioUrl(null)
    setError(null)
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      
      mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      })
      
      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (err) {
      setError('Error accessing microphone. Please make sure you have granted microphone permissions.')
      console.error('Error starting recording:', err)
    }
  }, [])
  
  const stopRecording = useCallback(async () => {
    return new Promise<void>((resolve) => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.addEventListener('stop', () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
          const audioUrl = URL.createObjectURL(audioBlob)
          
          setAudioBlob(audioBlob)
          setAudioUrl(audioUrl)
          setIsRecording(false)
          
          // Stop all audio tracks
          if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
          }
          
          resolve()
        })
        
        mediaRecorderRef.current.stop()
      } else {
        setIsRecording(false)
        resolve()
      }
    })
  }, [isRecording])
  
  return {
    isRecording,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    error
  }
} 