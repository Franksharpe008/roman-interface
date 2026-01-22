'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Mic, MicOff, Send, Volume2, VolumeX, Image as ImageIcon, Loader2, Sparkles, MessageSquare, MicIcon, Globe, Brain, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import * as webllm from "@mlc-ai/web-llm"

type MessageType = {
  id: string
  role: 'user' | 'assistant'
  content: string
  image?: string
  audio?: string
  timestamp: Date
}

type VoiceType = {
  id: string
  name: string
  gender: 'male' | 'female'
  language: string
}

function FloatingShapes() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute top-20 left-10 w-32 h-32 animate-bounce">
        <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 backdrop-blur-2xl" />
      </div>
      <div className="absolute top-40 right-20 w-24 h-24 animate-pulse">
        <div className="w-full h-full rounded-2xl bg-gradient-to-tr from-blue-500/10 via-cyan-500/10 to-purple-500/10 backdrop-blur-xl border border-white/10" />
      </div>
      <div className="absolute bottom-32 left-16 w-20 h-20 animate-spin">
        <div className="w-full h-full rounded-full bg-gradient-to-bl from-emerald-500/15 via-teal-500/15 to-cyan-500/15 backdrop-blur-2xl" />
      </div>
      <div className="absolute bottom-40 right-12 w-16 h-16 animate-bounce">
        <div className="w-full h-full rotate-45 bg-gradient-to-r from-orange-500/15 via-amber-500/15 to-yellow-500/15 backdrop-blur-xl border border-white/10" />
      </div>
    </div>
  )
}

export default function ChatBot() {
  const [messages, setMessages] = useState<MessageType[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [conversationMode, setConversationMode] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState('kazi')
  const [voices, setVoices] = useState<VoiceType[]>([])
  const [autoPlayVoice, setAutoPlayVoice] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const isAutoRecordingRef = useRef(false)

  // --- IMMERSION & WEBGPU STATE ---
  const [useWebGPU, setUseWebGPU] = useState(false)
  const [useCadence, setUseCadence] = useState(false)
  const [useHum, setUseHum] = useState(false)
  const [voiceRate, setVoiceRate] = useState(1.0)
  const [voicePitch, setVoicePitch] = useState(1.0)
  const [webGPUProgress, setWebGPUProgress] = useState(0)
  const [webGPULoading, setWebGPULoading] = useState(false)
  const [localEngine, setLocalEngine] = useState<any>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const humOscillatorRef = useRef<OscillatorNode | null>(null)
  const humGainNodeRef = useRef<GainNode | null>(null)

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }

  const startHum = () => {
    if (!useHum || !audioCtxRef.current || humOscillatorRef.current) return

    initAudio()
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(60, ctx.currentTime)
    gain.gain.setValueAtTime(0.02, ctx.currentTime)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()

    humOscillatorRef.current = osc
    humGainNodeRef.current = gain
  }

  const stopHum = () => {
    if (humOscillatorRef.current && humGainNodeRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current
      humGainNodeRef.current.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
      humOscillatorRef.current.stop(ctx.currentTime + 0.1)
      humOscillatorRef.current = null
      humGainNodeRef.current = null
    }
  }

  const initWebGPUEngine = async () => {
    if (localEngine) return
    setWebGPULoading(true)
    try {
      const engine = await webllm.CreateMLCEngine("gemma-2b-it-q4f16_1-MLC", {
        initProgressCallback: (report) => {
          setWebGPUProgress(report.progress)
        }
      })
      setLocalEngine(engine)
      toast.success("Gemma WebGPU Loaded Successfully")
    } catch (error) {
      console.error("WebGPU Init Error:", error)
      toast.error("Failed to load local model. Ensure WebGPU is enabled.")
      setUseWebGPU(false)
    } finally {
      setWebGPULoading(false)
    }
  }

  useEffect(() => {
    if (useWebGPU && !localEngine) {
      initWebGPUEngine()
    }
  }, [useWebGPU])

  useEffect(() => {
    setMounted(true)
    fetchVoices()
  }, [])

  useEffect(() => {
    if (scrollRef.current && mounted) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, mounted])

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollArea
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollButton(!isAtBottom)
    }

    scrollArea.addEventListener('scroll', handleScroll)
    return () => scrollArea.removeEventListener('scroll', handleScroll)
  }, [])

  const fetchVoices = async () => {
    try {
      const response = await fetch('/api/voices')
      const data = await response.json()
      if (data.success && data.voices) {
        setVoices(data.voices)
      }
    } catch (error) {
      console.error('Error fetching voices:', error)
    }
  }

  const startRecording = async (autoStart: boolean = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []
      isAutoRecordingRef.current = autoStart

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const audioBase64 = await blobToBase64(audioBlob)

        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: audioBase64 })
          })

          const data = await response.json()
          if (data.success && data.transcription) {
            if (autoStart) {
              await sendMessage(data.transcription, true)
            } else {
              setInput(data.transcription)
            }
          } else {
            if (!autoStart) toast.error('Failed to transcribe audio')
          }
        } catch (error) {
          if (!autoStart) toast.error('Error transcribing audio')
        }

        stream.getTracks().forEach(track => track.stop())
        isAutoRecordingRef.current = false
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (error) {
      toast.error('Could not access microphone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const playAudio = (audioUrl: string, messageId: string, autoPlay: boolean = false) => {
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current = null
    }

    const audio = new Audio(audioUrl)
    audioElementRef.current = audio

    if (autoPlay) {
      audio.onended = () => {
        setIsPlaying(null)
        audioElementRef.current = null
        if (conversationMode && !isRecording) {
          setTimeout(() => {
            startRecording(true)
          }, 500)
        }
      }
      audio.play()
      setIsPlaying(messageId)
    } else {
      if (isPlaying === messageId) {
        audio.pause()
        setIsPlaying(null)
      } else {
        audio.onended = () => {
          setIsPlaying(null)
          audioElementRef.current = null
        }
        audio.play()
        setIsPlaying(messageId)
      }
    }
  }

  const stopAllAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current = null
    }
    window.speechSynthesis.cancel()
    stopHum()
    setIsPlaying(null)
  }

  const cleanText = (text: string) => {
    return text.replace(/\*\*/g, "").replace(/##/g, "").replace(/```[\s\S]*?```/g, "").replace(/`/g, "")
  }

  const speakWithCadence = (text: string, messageId: string) => {
    window.speechSynthesis.cancel()
    const clean = cleanText(text).replace(/\n/g, ". ")
    const chunks = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean]

    let queueIndex = 0
    setIsPlaying(messageId)

    const speakNextChunk = () => {
      if (queueIndex >= chunks.length) {
        setIsPlaying(null)
        stopHum()
        if (conversationMode && !isRecording) {
          setTimeout(() => startRecording(true), 500)
        }
        return
      }

      let chunk = chunks[queueIndex].trim()
      if (!chunk) { queueIndex++; speakNextChunk(); return }

      const utterance = new SpeechSynthesisUtterance(chunk)
      const browserVoices = window.speechSynthesis.getVoices()
      // Try to match selectedVoice name if possible, else default
      const voice = browserVoices.find(v => v.name === selectedVoice) || browserVoices[0]
      if (voice) utterance.voice = voice

      const rateVar = voiceRate * (0.9 + Math.random() * 0.2)
      const pitchVar = voicePitch * (0.95 + Math.random() * 0.1)

      utterance.rate = rateVar
      utterance.pitch = pitchVar

      utterance.onend = () => {
        queueIndex++
        setTimeout(speakNextChunk, 100)
      }

      utterance.onerror = () => { queueIndex++; speakNextChunk() }

      window.speechSynthesis.speak(utterance)
    }

    startHum()
    speakNextChunk()
  }

  const generateSpeech = async (text: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: selectedVoice })
      })

      if (response.ok) {
        const blob = await response.blob()
        const audioUrl = URL.createObjectURL(blob)
        return audioUrl
      }
      return null
    } catch (error) {
      console.error('Error generating speech:', error)
      return null
    }
  }

  const sendMessage = async (messageText?: string, isAuto: boolean = false) => {
    const messageContent = messageText || input.trim()
    if (!messageContent || isLoading) return

    stopAllAudio()
    if (isRecording) {
      stopRecording()
    }

    const userMessage: MessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    if (!isAuto) setInput('')
    setIsLoading(true)

    try {
      const isImageRequest = messageContent.toLowerCase().includes('image') ||
        messageContent.toLowerCase().includes('picture') ||
        messageContent.toLowerCase().includes('photo') ||
        messageContent.toLowerCase().includes('draw') ||
        messageContent.toLowerCase().includes('create') ||
        messageContent.toLowerCase().includes('generate') ||
        messageContent.toLowerCase().includes('make')

      let aiContent = ''
      let aiImage: string | undefined
      let aiAudio: string | undefined

      if (isImageRequest) {
        try {
          const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: messageContent })
          })

          const data = await response.json()
          if (data.success && data.image) {
            aiImage = data.image
            aiContent = 'I created an image for you!'
          } else {
            aiContent = 'I could not generate the image. Please try again.'
          }
        } catch (error) {
          aiContent = 'Error generating image. Please try again.'
        }
      } else {
        if (useWebGPU && localEngine) {
          const messagesForGemma = [
            { role: 'system', content: 'You are Project ROMAN. Identity: Ultra Secure Autonomous Command Agent.' }, // Brief system prompt for Gemma
            ...messages.map(m => ({ role: m.role, content: m.content }))
          ]

          const chunks = await localEngine.chat.completions.create({
            messages: messagesForGemma,
            stream: true,
            max_tokens: 300,
            temperature: 0.7
          })

          for await (const chunk of chunks) {
            const delta = chunk.choices[0]?.delta?.content || ""
            aiContent += delta
            // We'll update the message in the finally block or via a streaming update if we had that set up.
            // For now, let's just collect it.
          }
        } else {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: messageContent })
          })

          const data = await response.json()
          aiContent = data.response || 'I apologize, but I could not generate a response.'
        }

        if (!useCadence) {
          const audioUrl = await generateSpeech(aiContent)
          if (audioUrl) {
            aiAudio = audioUrl
          }
        }
      }

      const assistantMessage: MessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiContent,
        image: aiImage,
        audio: aiAudio,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

      if (autoPlayVoice && !isImageRequest) {
        setTimeout(() => {
          if (useCadence) {
            speakWithCadence(aiContent, assistantMessage.id)
          } else if (aiAudio) {
            playAudio(aiAudio!, assistantMessage.id, true)
          }
        }, 300)
      }
    } catch (error) {
      toast.error('Error sending message')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const toggleConversationMode = () => {
    if (conversationMode) {
      setConversationMode(false)
      if (isRecording && isAutoRecordingRef.current) {
        stopRecording()
      }
    } else {
      setConversationMode(true)
      toast.success('Conversation mode enabled. Start speaking!')
      setTimeout(() => {
        startRecording(true)
      }, 500)
    }
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 relative" suppressHydrationWarning>
      <FloatingShapes />

      {webGPULoading && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-md border-b">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gemma WebGPU Loading...</span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${webGPUProgress * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-purple-600">{Math.round(webGPUProgress * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="w-full h-full animate-gradient" style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 50%, rgba(236, 72, 153, 0.1) 100%)',
          transition: 'background 20s linear infinite'
        }} />
      </div>

      <header className="relative z-10 border-b bg-white/70 backdrop-blur-xl flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-2xl animate-pulse">
                <Sparkles className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  AI Assistant
                </h1>
                <p className="text-sm text-slate-600 font-medium">
                  Voice • Images • Intelligence
                </p>
              </div>
            </div>
            <div>
              <Button
                onClick={toggleConversationMode}
                className={`px-6 py-2.5 rounded-2xl font-semibold text-sm transition-all ${conversationMode ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-2xl' : 'bg-white text-slate-700 shadow-lg border-2 border-slate-200'}`}
              >
                <AnimatePresence mode="wait">
                  {conversationMode ? (
                    <div className="flex items-center gap-2">
                      <MicIcon className="w-4 h-4" />
                      <span>Mode: ON</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>Mode: OFF</span>
                    </div>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 border-b bg-white/60 backdrop-blur-lg flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-700">Voice</label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="w-64 h-10 bg-white/80 backdrop-blur-sm border-2 border-slate-200">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl">
                  {voices.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{voice.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700">
                            {voice.gender}
                          </span>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse" />
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-xl border-2 border-slate-200 transition-all cursor-pointer hover:border-purple-300" onClick={() => setAutoPlayVoice(!autoPlayVoice)}>
                <Volume2 className={`w-5 h-5 transition-colors duration-300 ${autoPlayVoice ? 'text-purple-500' : 'text-slate-400'}`} strokeWidth={2.5} />
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 shadow-lg" style={{ transform: autoPlayVoice ? 'scale(1)' : 'scale(0)', opacity: autoPlayVoice ? '1' : '0' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600">Auto-play</span>
                  <span className={`text-xs font-medium ${autoPlayVoice ? 'text-green-600' : 'text-slate-400'}`}>
                    {autoPlayVoice ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block" />

            {/* IMMERSION CONTROLS */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={useWebGPU ? "default" : "outline"}
                  onClick={() => setUseWebGPU(!useWebGPU)}
                  className={`rounded-xl px-4 ${useWebGPU ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Gemma (Local)
                </Button>

                <Button
                  size="sm"
                  variant={useCadence ? "default" : "outline"}
                  onClick={() => setUseCadence(!useCadence)}
                  className={`rounded-xl px-4 ${useCadence ? 'bg-pink-600 hover:bg-pink-700 text-white' : ''}`}
                >
                  🎭 Cadence
                </Button>

                <Button
                  size="sm"
                  variant={useHum ? "default" : "outline"}
                  onClick={() => {
                    setUseHum(!useHum)
                    initAudio()
                  }}
                  className={`rounded-xl px-4 ${useHum ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : ''}`}
                >
                  🔊 Bio-Hum
                </Button>
              </div>

              <div className="flex items-center gap-4 bg-white/40 px-3 py-1.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 min-w-[100px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Rate</span>
                  <input
                    type="range"
                    min="0.5" max="2" step="0.1"
                    value={voiceRate}
                    onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                    className="flex-1 accent-purple-500 h-1"
                  />
                </div>
                <div className="flex items-center gap-2 min-w-[100px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pitch</span>
                  <input
                    type="range"
                    min="0.5" max="2" step="0.1"
                    value={voicePitch}
                    onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                    className="flex-1 accent-pink-500 h-1"
                  />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {conversationMode && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm border border-purple-300/50">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse" />
                    <span className="text-sm font-semibold text-purple-700">Listening...</span>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex-1 relative z-5 overflow-hidden">
        <div
          ref={scrollAreaRef}
          className="h-full overflow-y-auto overflow-x-hidden scroll-smooth"
        >
          <div className="container mx-auto px-4 py-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
                <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 shadow-2xl">
                  <Brain className="w-10 h-10 text-white" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 mb-3">
                    Welcome to AI Assistant
                  </h2>
                  <p className="text-lg text-slate-700 max-w-md leading-relaxed">
                    Experience a <span className="font-bold text-purple-600">world-class</span> conversational AI with{' '}
                    <span className="font-bold text-pink-600">seamless voice interactions</span> and{' '}
                    <span className="font-bold text-orange-500">stunning visuals</span>.
                  </p>
                  <div className="mt-8 flex flex-col gap-4">
                    <Button
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-xl text-white font-semibold hover:shadow-xl"
                      onClick={() => startRecording(false)}
                    >
                      <Mic className="w-6 h-6 text-white" strokeWidth={2.5} />
                      <span>Start with Voice</span>
                    </Button>
                    <Button
                      className="px-6 py-3 bg-white/80 backdrop-blur-sm border-2 border-slate-200 rounded-2xl text-slate-700 font-semibold hover:shadow-xl"
                      onClick={() => setInput('')}
                    >
                      <Globe className="w-6 h-6 text-purple-500" strokeWidth={2.5} />
                      <span>Or Type Your Message</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto pb-8">
                <AnimatePresence mode="popLayout">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    >
                      <Card className={`p-5 relative overflow-hidden ${message.role === 'user' ? 'bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200 ml-8 shadow-lg' : 'bg-gradient-to-br from-purple-50/50 to-pink-50/50 backdrop-blur-sm border-2 border-purple-200/50 mr-8 shadow-xl shadow-purple-500/10'}`}>
                        <div className="flex items-start gap-4">
                          <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${message.role === 'user' ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/40' : 'bg-gradient-to-br from-cyan-500 to-blue-500 shadow-cyan-500/40'}`}>
                            {message.role === 'user' ? <Globe className="w-6 h-6 text-white" strokeWidth={2} /> : <Sparkles className="w-6 h-6 text-white" strokeWidth={2} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold mb-2 text-slate-700">{message.role === 'user' ? 'You' : 'AI Assistant'}</p>
                            <p className="text-sm whitespace-pre-wrap break-words text-slate-600 leading-relaxed">{message.content}</p>
                            {message.image && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                className="mt-4 relative group"
                              >
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-pink-500/30 blur-2xl rounded-2xl" />
                                <img
                                  src={message.image}
                                  alt="Generated image"
                                  className="relative z-10 rounded-xl max-w-full h-auto border-2 border-white/50 shadow-2xl group-hover:scale-[1.02] transition-transform duration-300"
                                />
                              </motion.div>
                            )}
                            <div className="flex items-center gap-3 mt-4">
                              {message.audio && (
                                <Button
                                  onClick={() => playAudio(message.audio!, message.id, false)}
                                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
                                >
                                  <AnimatePresence mode="wait">
                                    {isPlaying === message.id ? (
                                      <div className="flex items-center gap-2">
                                        <VolumeX className="w-4 h-4" strokeWidth={2.5} />
                                        <span>Stop</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <Volume2 className="w-4 h-4" strokeWidth={2.5} />
                                        <span>Play</span>
                                      </div>
                                    )}
                                  </AnimatePresence>
                                </Button>
                              )}
                              {message.image && (
                                <Button
                                  onClick={() => {
                                    const link = document.createElement('a')
                                    link.href = message.image!
                                    link.download = `generated-image-${message.id}.png`
                                    link.click()
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border-2 border-slate-200 rounded-xl text-slate-700 font-semibold hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
                                >
                                  <ImageIcon className="w-4 h-4" strokeWidth={2.5} />
                                  <span>Download</span>
                                </Button>
                              )}
                              <span className="text-xs text-slate-400 ml-auto font-medium">
                                {message.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto"
                  >
                    <Card className="p-5 mr-8 bg-gradient-to-br from-purple-50/50 to-pink-50/50 backdrop-blur-sm border-2 border-purple-200/50 shadow-xl shadow-purple-500/10">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
                          <Sparkles className="w-6 h-6 text-white" strokeWidth={2} />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-slate-700">AI is thinking...</span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
                <div ref={scrollRef} />
              </div>
            )}
          </div>
        </div>

        {showScrollButton && (
          <Button
            onClick={scrollToBottom}
            className="fixed bottom-36 right-8 z-30 w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-2xl hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center"
          >
            <ArrowDown className="w-5 h-5" strokeWidth={2.5} />
          </Button>
        )}
      </div>

      <div className="relative z-20 border-t bg-white/70 backdrop-blur-xl flex-shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            {!conversationMode && (
              <Button
                onClick={() => isRecording ? stopRecording() : startRecording(false)}
                disabled={isLoading || conversationMode}
                className={`relative overflow-hidden px-4 h-11 rounded-2xl font-semibold transition-all ${isRecording ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-2xl' : 'bg-white text-slate-700 shadow-lg border-2 border-slate-200 hover:shadow-xl hover:border-purple-300'}`}
              >
                {isRecording && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-full rounded-full border-2 border-white/50" />
                  </div>
                )}
                <AnimatePresence mode="wait">
                  {isRecording ? (
                    <motion.div
                      key="recording"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <MicOff className="w-5 h-5" strokeWidth={2.5} />
                      <span>Stop</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="not-recording"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <Mic className="w-5 h-5" strokeWidth={2.5} />
                      <span>Record</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            )}

            {!conversationMode && (
              <div className="flex-1 relative">
                <Input
                  placeholder="Type a message. Use 'image', 'picture', 'draw', 'create' or 'generate' to create images..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={isLoading || isRecording || conversationMode}
                  className="pr-12 h-11 bg-white/80 backdrop-blur-sm border-2 border-slate-200 focus:border-purple-400 focus:shadow-xl transition-all"
                />
              </div>
            )}

            {!conversationMode && (
              <Button
                onClick={() => sendMessage()}
                disabled={isLoading || isRecording || conversationMode || !input.trim()}
                className="relative overflow-hidden px-6 h-11 rounded-2xl font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-2xl hover:shadow-xl transition-all duration-300"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5" strokeWidth={2.5} />
                ) : (
                  <>
                    <Send className="w-5 h-5" strokeWidth={2.5} />
                    <span>Send</span>
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-2 text-center max-w-3xl mx-auto font-medium leading-relaxed">
            {!conversationMode ? (
              <>
                Press Enter to send • Use microphone to record voice messages • Type 'image', 'picture', 'draw', 'create' or 'generate' to create images
              </>
            ) : (
              <>
                <span className="font-semibold text-purple-600">Conversation mode active</span> - just start speaking! Click "Mode: ON" to stop.
              </>
            )}
          </p>
        </div>
      </div>

      <footer className="relative z-20 border-t bg-white/70 backdrop-blur-xl py-4 flex-shrink-0">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-6 animate-spin">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
            </div>
            <span className="text-sm font-medium text-slate-700">
              Powered by <span className="font-bold text-purple-600">z-ai-web-dev-sdk</span> • Built with <span className="font-bold text-pink-600">Next.js</span> & <span className="font-bold text-cyan-600">TypeScript</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
