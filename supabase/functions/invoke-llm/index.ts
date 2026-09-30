// supabase/functions/invoke-llm/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Supported Anthropic image media types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// ─── Dealer Intel RAG ────────────────────────────────────────────────────────
// If OPENAI_API_KEY is configured, invoke the dealer-intel-rag function before
// the chat completion call to ground the response in approved tactic cards.
// Fails safe: if retrieval fails or is unconfigured, the chat call proceeds
// with an empty intel block that instructs the model not to claim grounding.

async function fetchDealerIntel(
  prompt: string,
  turnRef: string,
  userId: string | null
): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  // RAG is optional — skip quietly if not configured
  if (!openaiKey || !supabaseUrl || !serviceKey) {
    return '\nDEALER INTEL\nDealer Intel retrieval is not configured for this environment.\nEND DEALER INTEL\n'
  }

  try {
    const ragUrl = `${supabaseUrl}/functions/v1/dealer-intel-rag`
    const ragRes = await fetch(ragUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        turn_ref: turnRef,
        input_kind: 'text',
        input_text: prompt,
        user_id: userId,
      }),
    })
    if (!ragRes.ok) {
      console.warn(`dealer-intel-rag returned ${ragRes.status}`)
      return '\nDEALER INTEL\nDealer Intel retrieval was unavailable for this turn.\nEND DEALER INTEL\n'
    }
    const ragData = await ragRes.json()
    return ragData?.system_prompt_block ?? '\nDEALER INTEL\nNo block returned.\nEND DEALER INTEL\n'
  } catch (err) {
    console.warn('dealer-intel-rag fetch failed:', (err as Error).name)
    return '\nDEALER INTEL\nDealer Intel retrieval was unavailable for this turn.\nEND DEALER INTEL\n'
  }
}
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { prompt, file_urls, model, response_json_schema, user_id, turn_ref } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map model names to valid Anthropic API model IDs
    const modelMap: Record<string, string> = {
      'claude-haiku-4-5': 'claude-haiku-4-5',
      'claude-sonnet-4-5': 'claude-sonnet-4-5',
      'claude-sonnet-4-6': 'claude-sonnet-4-6',
      'claude-3-5-haiku': 'claude-haiku-4-5',
      'claude-3-5-sonnet': 'claude-sonnet-4-5',
      'claude-opus-4-5': 'claude-opus-4-5',
      'gemini-3-flash': 'claude-haiku-4-5',
      'gemini-flash': 'claude-haiku-4-5',
    }

    // Default to Haiku — fastest and cheapest
    const anthropicModel = modelMap[model] || 'claude-haiku-4-5'

    // ── RAG retrieval (runs before the chat call) ──────────────────────────
    // Only run RAG on chat turns (not JSON-schema extraction requests)
    let intelSystemBlock = ''
    if (!response_json_schema) {
      const resolvedTurnRef = turn_ref || `turn-${crypto.randomUUID()}`
      intelSystemBlock = await fetchDealerIntel(
        prompt,
        resolvedTurnRef,
        user_id ?? null
      )
    }
    // ──────────────────────────────────────────────────────────────────────

    // Build content array — images first, then text (best practice for vision)
    type ContentBlock =
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

    const contentBlocks: ContentBlock[] = []

    // Fetch and base64-encode any provided images
    if (file_urls && Array.isArray(file_urls) && file_urls.length > 0) {
      for (const url of file_urls) {
        try {
          const imageResponse = await fetch(url)
          if (!imageResponse.ok) {
            console.error(`Failed to fetch image from ${url}: ${imageResponse.status}`)
            continue
          }

          const imageBuffer = await imageResponse.arrayBuffer()
          const imageBytes = new Uint8Array(imageBuffer)

          // Convert to base64 in chunks to avoid stack overflow on large images
          const chunkSize = 8192
          let binary = ''
          for (let i = 0; i < imageBytes.length; i += chunkSize) {
            const chunk = imageBytes.subarray(i, i + chunkSize)
            binary += String.fromCharCode(...chunk)
          }
          const base64Data = btoa(binary)

          // Determine media type — default to jpeg if unknown
          const rawContentType = imageResponse.headers.get('content-type') || ''
          const mediaType = SUPPORTED_IMAGE_TYPES.find(t => rawContentType.includes(t)) ?? 'image/jpeg'

          contentBlocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data
            }
          })

          console.log(`Image fetched and encoded: ${url} (${mediaType}, ${imageBytes.length} bytes)`)
        } catch (fetchErr) {
          console.error(`Error fetching image ${url}:`, fetchErr)
        }
      }
    }

    // Add text prompt after images
    contentBlocks.push({
      type: 'text',
      text: prompt
    })

    const messages = [
      {
        role: 'user',
        content: contentBlocks
      }
    ]

    // Build request to Anthropic
    const anthropicRequest: Record<string, unknown> = {
      model: anthropicModel,
      max_tokens: 4096,
      messages
    }

    // Build system prompt: JSON schema mode OR base coaching + RAG intel
    if (response_json_schema) {
      anthropicRequest.system = `Respond with valid JSON that matches this schema: ${JSON.stringify(response_json_schema)}`
    } else if (intelSystemBlock) {
      // Prepend the RAG intel block so the model sees grounding before the user message
      anthropicRequest.system = intelSystemBlock
    }

    // Call Anthropic API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicRequest)
    })

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text()
      console.error('Anthropic API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'LLM API error', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anthropicData = await anthropicResponse.json()

    // Extract the text response
    let responseText = ''
    if (anthropicData.content && Array.isArray(anthropicData.content)) {
      for (const block of anthropicData.content) {
        if (block.type === 'text') {
          responseText += block.text
        }
      }
    }

    return new Response(
      JSON.stringify(responseText),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in invoke-llm:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
