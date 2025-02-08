
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    if (!accessToken || !phoneNumberId) {
      throw new Error('Missing required environment variables')
    }

    const { message_type, recipient, content } = await req.json()

    // Validate required fields
    if (!message_type || !recipient || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare the WhatsApp API request
    let messageData: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
    }

    // Add message content based on type
    switch (message_type) {
      case 'text':
        messageData.type = 'text'
        messageData.text = { body: content.text }
        break
      
      case 'template':
        messageData.type = 'template'
        messageData.template = {
          name: content.template_name,
          language: { code: content.language || 'en' },
          components: content.components || []
        }
        break
      
      case 'media':
        messageData.type = content.media_type // image, video, document
        messageData[content.media_type] = {
          link: content.url,
          caption: content.caption
        }
        break
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid message type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Send message to WhatsApp API
    const response = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      console.error('WhatsApp API error:', result)
      throw new Error('Failed to send WhatsApp message')
    }

    // Store message in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: userData } = await supabase
      .from('whatsapp_users')
      .select('id')
      .eq('phone_number', recipient)
      .single()

    const messageRecord = {
      whatsapp_message_id: result.messages[0].id,
      user_id: userData?.id,
      direction: 'outgoing',
      message_type,
      content,
      status: 'sent'
    }

    const { error: dbError } = await supabase
      .from('messages')
      .insert(messageRecord)

    if (dbError) {
      console.error('Database error:', dbError)
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
