import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(req: NextRequest) {
  try {
    const { audio } = await req.json()

    if (!audio || typeof audio !== 'string') {
      return NextResponse.json(
        { error: 'Audio data is required and must be a base64 string' },
        { status: 400 }
      )
    }

    // Extract base64 data if it includes the data URL prefix
    const base64Data = audio.includes('base64,')
      ? audio.split('base64,')[1]
      : audio

    // Create ZAI instance
    const zai = await ZAI.create()

    // Transcribe audio
    const response = await zai.audio.asr.create({
      file_base64: base64Data
    })

    const transcription = response.text

    if (!transcription) {
      return NextResponse.json(
        { error: 'Failed to transcribe audio' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      transcription: transcription.trim()
    })
  } catch (error) {
    console.error('ASR API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred while transcribing audio'
      },
      { status: 500 }
    )
  }
}
