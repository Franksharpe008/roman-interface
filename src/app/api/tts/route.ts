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
      try {
        const apiKey = process.env.OPENAI_API_KEY

        if (!apiKey) {
          throw new Error('OPENAI_API_KEY is not defined')
        }

        const openai = new OpenAI({
          apiKey: apiKey,
          timeout: 10000,
        })

        const mp3 = await openai.audio.speech.create({
          model: 'tts-1', // Standard OpenAI TTS model
          voice: voice as any,
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
        console.error('OpenAI TTS service error:', error instanceof Error ? error.message : error)
        // Fallback to ZAI voice if OpenAI fails? Or just return error?
        // Returning error is safer for now to alert user of missing config.
        return NextResponse.json(
          {
            error: 'Failed to generate American voice. Please check OPENAI_API_KEY.',
            details: error instanceof Error ? error.message : 'Unknown error'
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
