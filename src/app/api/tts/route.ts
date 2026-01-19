import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// z-ai-web-dev-sdk voices
const ZAI_VOICES = [
  'tongtong', 'chuichui', 'xiaochen', 'jam', 'kazi', 'douji', 'luodo'
]

// OpenAI-compatible voices (American voices)
const OPENAI_VOICES = [
  'af_heart', 'af_nicole', 'af_sky', 'af_bella', 'af_nova',
  'am_adam', 'am_echo', 'am_eric', 'am_michael', 'am_liam',
  'bf_emma', 'bf_isabella', 'bf_george', 'bf_lewis',
  'bm_daniel', 'bm_george', 'bm_lewis'
]

const MAX_TEXT_LENGTH = 1024

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 1.2 } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const trimmedText = text.trim()

    if (trimmedText.length === 0) {
      return NextResponse.json({ error: 'Text cannot be empty' }, { status: 400 })
    }

    const textToSpeak = trimmedText.length > MAX_TEXT_LENGTH
      ? trimmedText.substring(0, MAX_TEXT_LENGTH)
      : trimmedText

    if (speed < 0.5 || speed > 2.0) {
      return NextResponse.json({ error: 'Speed must be between 0.5 and 2.0' }, { status: 400 })
    }

    // Check if it's an OpenAI voice (American voices) or z-ai voice
    const isOpenAIVoice = OPENAI_VOICES.includes(voice)

    if (isOpenAIVoice) {
      // Use OpenAI-compatible TTS service (for American voices)
      // Only try OpenAI service if it's explicitly an OpenAI voice
      try {
        const openai = new OpenAI({
          baseURL: 'http://localhost:5173/api/v1',
          apiKey: 'no-key',
          timeout: 5000, // 5 second timeout
        })

        const mp3 = await openai.audio.speech.create({
          model: 'model_q8f16',
          voice: voice,
          input: textToSpeak,
        })

        const arrayBuffer = await mp3.arrayBuffer()
        const buffer = Buffer.from(new Uint8Array(arrayBuffer))

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'no-cache',
          },
        })
      } catch (error) {
        // OpenAI service not available or timeout, return error immediately
        console.error('OpenAI TTS service unavailable:', error.message)
        return NextResponse.json(
          { 
            error: 'American voice requires TTS service at localhost:5173. Using z-ai voices instead.',
            fallbackVoice: 'kazi' 
          },
          { status: 500 }
        )
      }
    }

    // Use z-ai-web-dev-sdk TTS for z-ai voices
    if (!ZAI_VOICES.includes(voice)) {
      return NextResponse.json({ error: 'Invalid voice ID' }, { status: 400 })
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    const response = await zai.audio.tts.create({
      input: textToSpeak,
      voice: voice,
      speed: speed,
      response_format: 'wav',
      stream: false
    })

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('TTS API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'TTS failed' },
      { status: 500 }
    )
  }
}
