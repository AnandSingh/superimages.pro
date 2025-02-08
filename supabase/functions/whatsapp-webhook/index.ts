
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const url = new URL(req.url)
  console.log('Webhook request:', {
    method: req.method,
    pathname: url.pathname,
    searchParams: Object.fromEntries(url.searchParams)
  })

  // Handle verification request
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    console.log('Verification request:', { mode, token, challenge })

    // Verify mode and token
    if (mode === 'subscribe' && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
      console.log('Verification successful, returning challenge:', challenge)
      return new Response(challenge)
    }

    console.log('Verification failed')
    return new Response('Forbidden', { status: 403 })
  }

  // For now, just acknowledge POST requests
  if (req.method === 'POST') {
    const body = await req.json()
    console.log('Received webhook:', JSON.stringify(body, null, 2))
    return new Response('OK')
  }

  return new Response('Method not allowed', { status: 405 })
})
