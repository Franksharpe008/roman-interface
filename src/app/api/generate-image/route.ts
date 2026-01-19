import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// Supported image sizes
const SUPPORTED_SIZES = [
  '1024x1024',
  '768x1344',
  '864x1152',
  '1344x768',
  '1152x864',
  '1440x720',
  '720x1440'
]

export async function POST(req: NextRequest) {
  try {
    const { prompt, size = '1024x1024' } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      )
    }

    const trimmedPrompt = prompt.trim()

    if (trimmedPrompt.length === 0) {
      return NextResponse.json(
        { error: 'Prompt cannot be empty' },
        { status: 400 }
      )
    }

    // Validate size parameter
    if (!SUPPORTED_SIZES.includes(size)) {
      return NextResponse.json(
        { error: `Invalid size. Supported sizes: ${SUPPORTED_SIZES.join(', ')}` },
        { status: 400 }
      )
    }

    // Create ZAI instance
    const zai = await ZAI.create()

    // Generate image
    const response = await zai.images.generations.create({
      prompt: trimmedPrompt,
      size: size
    })

    const imageBase64 = response.data[0]?.base64

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Failed to generate image' },
        { status: 500 }
      )
    }

    // Convert base64 to data URL
    const dataUrl = `data:image/png;base64,${imageBase64}`

    return NextResponse.json({
      success: true,
      image: dataUrl,
      prompt: trimmedPrompt,
      size: size
    })
  } catch (error) {
    console.error('Image Generation API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred while generating image'
      },
      { status: 500 }
    )
  }
}
