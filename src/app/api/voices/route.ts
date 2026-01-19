import { NextResponse } from 'next/server'

// z-ai-web-dev-sdk voices
const ZAI_VOICES = [
  { id: 'tongtong', name: 'Tongtong (温暖亲切)', gender: 'female', language: 'zh', type: 'zai' },
  { id: 'chuichui', name: 'Chuichui (活泼可爱)', gender: 'female', language: 'zh', type: 'zai' },
  { id: 'xiaochen', name: 'Xiaochen (沉稳专业)', gender: 'female', language: 'zh', type: 'zai' },
  { id: 'jam', name: 'Jam (英音绅士)', gender: 'male', language: 'en', type: 'zai' },
  { id: 'kazi', name: 'Kazi (清晰标准)', gender: 'male', language: 'en', type: 'zai' },
  { id: 'douji', name: 'Douji (自然流畅)', gender: 'male', language: 'en', type: 'zai' },
  { id: 'luodo', name: 'Luodo (富有感染力)', gender: 'male', language: 'en', type: 'zai' },
]

// OpenAI-compatible American voices (if user has TTS service running on localhost:5173)
// Combine both voice lists
const AVAILABLE_VOICES = [...ZAI_VOICES]

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      voices: AVAILABLE_VOICES
    })
  } catch (error) {
    console.error('Voices API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch voices'
      },
      { status: 500 }
    )
  }
}
