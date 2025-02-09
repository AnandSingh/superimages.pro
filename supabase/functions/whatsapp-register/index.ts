
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { pin } = await req.json()

    if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
      throw new Error('Invalid PIN format. Must be 6 digits.')
    }

    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')

    if (!phoneNumberId || !accessToken) {
      throw new Error('Missing WhatsApp configuration')
    }

    console.log('Attempting to register WhatsApp number with PIN:', pin)

    const response = await fetch(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/register`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          pin: pin
        }),
      }
    )

    const result = await response.json()
    console.log('WhatsApp registration response:', result)

    if (!response.ok) {
      throw new Error(result.error?.message || 'Failed to register WhatsApp number')
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in registration:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
