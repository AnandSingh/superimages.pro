
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WhatsAppMessage {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        contacts: Array<{
          profile: {
            name: string
          }
          wa_id: string
        }>
        messages: Array<{
          from: string
          text: {
            body: string
          }
          timestamp: string
          type: string
        }>
      }
      field: string
    }>
  }>
}

// Parse expense message in format: "expense 50 groceries lunch at walmart"
// Returns: { amount: 50, category: "groceries", description: "lunch at walmart" }
function parseExpenseMessage(message: string) {
  const parts = message.toLowerCase().split(' ')
  if (parts[0] !== 'expense') return null

  const amount = parseFloat(parts[1])
  if (isNaN(amount)) return null

  const category = parts[2] || null
  const description = parts.slice(3).join(' ') || null

  return { amount, category, description }
}

async function handleWhatsAppMessage(message: WhatsAppMessage, supabase: any) {
  const entry = message.entry[0]
  const change = entry.changes[0]
  const value = change.value
  
  if (!value.messages || value.messages.length === 0) {
    return { error: 'No messages found' }
  }

  const whatsappMessage = value.messages[0]
  const contact = value.contacts[0]
  const phoneNumber = whatsappMessage.from
  const messageText = whatsappMessage.text.body
  const timestamp = new Date(parseInt(whatsappMessage.timestamp) * 1000)

  // Update or create WhatsApp user
  const { data: userData, error: userError } = await supabase
    .from('whatsapp_users')
    .upsert({
      phone_number: phoneNumber,
      first_name: contact.profile.name,
      last_active: timestamp.toISOString()
    }, {
      onConflict: 'phone_number'
    })
    .select()
    .single()

  if (userError) {
    return { error: 'Failed to update user' }
  }

  // Parse and store expense if valid
  const expenseData = parseExpenseMessage(messageText)
  if (expenseData) {
    const { data: expenseResult, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        user_id: userData.id,
        amount: expenseData.amount,
        category: expenseData.category,
        description: expenseData.description,
        date: timestamp.toISOString()
      })

    if (expenseError) {
      return { error: 'Failed to create expense' }
    }

    // Send confirmation message back to user
    await sendWhatsAppMessage(
      phoneNumber,
      `✅ Expense recorded:\nAmount: $${expenseData.amount}${expenseData.category ? `\nCategory: ${expenseData.category}` : ''}${expenseData.description ? `\nDescription: ${expenseData.description}` : ''}`
    )
    
    return { success: true, expense: expenseResult }
  }

  // Send help message for invalid format
  await sendWhatsAppMessage(
    phoneNumber,
    'To record an expense, send a message in this format:\nexpense <amount> <category> <description>\n\nExample: expense 50 groceries lunch at walmart'
  )

  return { success: true, message: 'Help message sent' }
}

async function sendWhatsAppMessage(to: string, message: string) {
  const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  if (!WHATSAPP_TOKEN) {
    throw new Error('Missing WhatsApp access token')
  }

  const response = await fetch('https://graph.facebook.com/v12.0/me/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      text: { body: message },
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to send WhatsApp message')
  }

  return response.json()
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Handle WhatsApp verification request
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      if (mode === 'subscribe' && token === Deno.env.get('WHATSAPP_VERIFY_TOKEN')) {
        return new Response(challenge, {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        })
      }
      return new Response('Invalid verify token', { status: 403 })
    }

    // Handle incoming WhatsApp messages
    const message: WhatsAppMessage = await req.json()
    const result = await handleWhatsAppMessage(message, supabaseClient)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
