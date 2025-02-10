
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
      event = await stripe.webhooks.constructEventAsync(
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

    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object;
        console.log('Processing paid invoice:', invoice.id);
        
        // Get customer phone number from invoice and remove '+' prefix if present
        const customerPhone = invoice.customer_phone?.replace(/^\+/, '');
        if (!customerPhone) {
          console.error('No customer phone number found in invoice');
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('Looking up user with phone number:', customerPhone);

        // Find user by phone number
        const { data: userData, error: userError } = await supabase
          .from('whatsapp_users')
          .select('id, phone_number')
          .eq('phone_number', customerPhone)
          .maybeSingle();

        if (userError) {
          console.error('Database error finding user:', userError);
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!userData) {
          console.error(`No user found with phone number ${customerPhone}. Payment will need manual reconciliation.`);
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get subscription and product details
        const subscription = invoice.subscription 
          ? await stripe.subscriptions.retrieve(invoice.subscription)
          : null;
        
        let creditsAmount = 0;
        let productId = '';

        try {
          if (subscription) {
            // For subscription payments
            const items = subscription.items.data[0];
            const price = await stripe.prices.retrieve(items.price.id);
            const product = await stripe.products.retrieve(price.product);
            
            creditsAmount = subscription.metadata.credits_amount 
              ? parseInt(subscription.metadata.credits_amount) 
              : (product.metadata.credits_amount 
                ? parseInt(product.metadata.credits_amount) 
                : 0);
            productId = product.id;
          } else {
            // For one-time payments
            const lineItem = invoice.lines.data[0];
            const price = await stripe.prices.retrieve(lineItem.price.id);
            const product = await stripe.products.retrieve(price.product);
            
            creditsAmount = product.metadata.credits_amount 
              ? parseInt(product.metadata.credits_amount) 
              : 0;
            productId = product.id;
          }

          if (creditsAmount > 0) {
            // Add credits to user
            const { error: creditError } = await supabase.rpc(
              'add_user_credits',
              {
                p_user_id: userData.id,
                p_amount: creditsAmount,
                p_transaction_type: 'purchase',
                p_product_type: 'image_generation',
                p_metadata: {
                  invoice_id: invoice.id,
                  subscription_id: subscription?.id,
                  product_id: productId,
                },
              }
            );

            if (creditError) {
              console.error('Error adding credits:', creditError);
              return new Response(JSON.stringify({ received: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }

            // Send WhatsApp notification
            try {
              const message = subscription
                ? `🎉 Your subscription credits (${creditsAmount}) have been added to your account.\n\nSend "balance" to check your new credit balance.`
                : `🎉 Payment successful! ${creditsAmount} credits have been added to your account.\n\nSend "balance" to check your new credit balance.`;

              await supabase.functions.invoke('whatsapp-send', {
                body: {
                  message_type: 'text',
                  recipient: customerPhone,
                  content: {
                    text: message
                  }
                }
              });
            } catch (notificationError) {
              console.error('Error sending WhatsApp notification:', notificationError);
              // Continue processing - notification failure shouldn't affect webhook response
            }
          }
        } catch (processingError) {
          console.error('Error processing payment details:', processingError);
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('Subscription updated:', subscription.id);
        // You might want to handle subscription updates differently
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('Subscription cancelled:', subscription.id);
        // You might want to handle subscription cancellations differently
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    // Only return 400 for webhook processing errors (signature, parsing)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
