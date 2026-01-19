import { NextRequest, NextResponse } from 'next/server'

const MAX_TEXT_LENGTH = 1024

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'kazi', speed = 1.0 } = await req.json()

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

    // Use z-ai-web-dev-sdk TTS
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()

    // Assuming ZAI SDK can handle error or mismatch mapping, or we just pass the voice.
    // Since we filtered the list in /voices, the frontend should only send valid IDs.

    console.log(`Generating TTS with ZAI SDK. Voice: ${voice}, Text length: ${textToSpeak.length}`)

    const response = await zai.audio.tts.create({
      input: textToSpeak,
      voice: voice,
      speed: speed,
      response_format: 'wav', // ZAI uses wav by default often
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
