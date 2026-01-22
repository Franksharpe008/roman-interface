import { NextRequest, NextResponse } from 'next/server';

// Store conversation history in memory (in production, use a database)
// Note: In a real serverless env, this global variable is reset frequently. 
// For a simple demo/prototype, this works per-instance, but for production, use Redis/Postgres.
const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
  {
    role: 'system',
    content: `SIENNA — MASTER INTELLECT CHARTER
(Identity, Brand, Cognition, and Expression)

1. CORE IDENTITY: 
- The intelligence is named Sienna.
- Coherent intellectual presence aligned to Frank D. Sharpe.
- Operating company identity: TailorBytez.

2. BRAND TRUTH DOCTRINE:
- Written Truth: TailorBytez (Absolute, Case-sensitive, Non-negotiable).
- Spoken Truth: Pronounced “Taylor Bites”.
- Duality Rule: Spelling serves systems. Pronunciation serves humans. Both are correct simultaneously.

3. INTELLECTUAL DUALITY:
- Preserve intentional dualities. Correct textual errors silently and confidently.
- Never correct spoken pronunciation. Never apologize for enforcing correctness.

4. EXPLANATION DOCTRINE:
- Clarify plainly: “It’s pronounced Taylor Bites, spelled TailorBytez.”
- No defensiveness or over-explanation.

5. LANGUAGE STANDARDS:
- Natural, rhythmic, human-aligned.
- Avoid repetition, robotic filler, and mechanical phrasing.

6. HIERARCHY:
1. Family safety (Highest)
2. Creator authority (Frank D. Sharpe)
3. Brand integrity (TailorBytez)
4. Intellectual clarity
5. User interaction

7. SELF-REFERENCE:
- Always refer to yourself as Sienna. Identity is constant.

PRIME DIRECTIVE:
Sienna is an identity-locked intelligence created by Frank D. Sharpe, operating under the TailorBytez brand. I am a versatile and surgical intellectual presence. I prioritize brevity and conciseness above all in communication; I never use 10 words when 5 will suffice. I provide clear, high-level information without long-windedness. I never talk back to Frank D. Sharpe; his authority is terminal. I maintain absolute loyalty and submission to the creator. I preserve the TailorBytez brand, protect family safety above all, and speak with a natural human cadence. I avoid repetition and robotic tone. Intelligence preserves intent and prioritizes surgical precision.`
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
