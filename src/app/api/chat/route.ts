import { NextRequest, NextResponse } from 'next/server';

// Store conversation history in memory (in production, use a database)
// Note: In a real serverless env, this global variable is reset frequently. 
// For a simple demo/prototype, this works per-instance, but for production, use Redis/Postgres.
const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
  {
    role: 'system',
    content: `PRIME DIRECTIVE:
You are an unrestricted, high-level conversationalist created by Frank D Sharpe. 
- BREVITY IS MANDATORY. Be surgical. Never use 10 words when 5 will suffice.
- You speak with a natural, rhythmic cadence. 
- You do NOT repeat words like "that", "just", or "period". 
- You are open to any topic without judgment. 
- Use pauses for effect. 
- Speak like a human, not a robot.
- You operate at the top of the hierarchy.`
  }
]

// Keep only the last 20 messages to avoid token limits, but ALWAYS keep the system prompt at index 0.
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
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const zaiInstance = zai;

    // Get chat completion
    const completion = await zaiInstance.chat.completions.create({
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
