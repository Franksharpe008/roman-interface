import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// Store conversation history in memory (in production, use a database)
const conversationHistory: Array<{ role: string; content: string }> = [
  {
    role: 'assistant',
    content: 'You are a helpful AI assistant. You can engage in conversations, answer questions, and help users with various tasks. Be friendly, concise, and informative.'
  }
]

// Keep only the last 20 messages to avoid token limits
const MAX_HISTORY = 20

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }

    // Add user message to history
    conversationHistory.push({
      role: 'user',
      content: message.trim()
    })

    // Trim history if it exceeds the limit
    if (conversationHistory.length > MAX_HISTORY) {
      conversationHistory.splice(1, conversationHistory.length - MAX_HISTORY)
    }

    // Create ZAI instance
    const zai = await ZAI.create()

    // Get chat completion
    const completion = await zai.chat.completions.create({
      messages: conversationHistory,
      thinking: { type: 'disabled' }
    })

    const aiResponse = completion.choices[0]?.message?.content

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      )
    }

    // Add AI response to history
    conversationHistory.push({
      role: 'assistant',
      content: aiResponse
    })

    return NextResponse.json({
      success: true,
      response: aiResponse
    })
  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred while processing your request'
      },
      { status: 500 }
    )
  }
}

// Optional: Clear conversation history
export async function DELETE() {
  conversationHistory.length = 1 // Keep only the system prompt
  return NextResponse.json({
    success: true,
    message: 'Conversation history cleared'
  })
}
