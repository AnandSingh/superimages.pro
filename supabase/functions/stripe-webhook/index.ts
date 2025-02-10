
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      throw new Error('Missing Stripe webhook signature or secret');
    }

    const body = await req.text();
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error(`Webhook signature verification failed:`, err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing webhook event:', event.type);

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      
      // Update payment transaction status
      const { error: updateError } = await supabase
        .from('payment_transactions')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      if (updateError) {
        console.error('Error updating payment status:', updateError);
        throw updateError;
      }

      // Add credits to user
      const { error: creditError } = await supabase.rpc(
        'add_user_credits',
        {
          p_user_id: paymentIntent.metadata.user_id,
          p_amount: parseInt(paymentIntent.metadata.credits_amount),
          p_transaction_type: 'purchase',
          p_product_type: 'image_generation',
          p_metadata: {
            payment_intent_id: paymentIntent.id,
            product_id: paymentIntent.metadata.product_id,
          },
        }
      );

      if (creditError) {
        console.error('Error adding credits:', creditError);
        throw creditError;
      }

      // Send WhatsApp notification
      const { data: userData } = await supabase
        .from('whatsapp_users')
        .select('phone_number')
        .eq('id', paymentIntent.metadata.user_id)
        .single();

      if (userData) {
        await supabase.functions.invoke('whatsapp-send', {
          body: {
            message_type: 'text',
            recipient: userData.phone_number,
            content: {
              text: `🎉 Payment successful! ${paymentIntent.metadata.credits_amount} credits have been added to your account.

Send "balance" to check your new credit balance.`
            }
          }
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
})
