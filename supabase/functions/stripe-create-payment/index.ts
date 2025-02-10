
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

    const { phone_number, product_id } = await req.json();

    if (!phone_number || !product_id) {
      throw new Error('Missing required parameters');
    }

    console.log('Creating payment intent for:', { phone_number, product_id });

    // Get user and product information
    const { data: userData, error: userError } = await supabase
      .from('whatsapp_users')
      .select('id, phone_number')
      .eq('phone_number', phone_number)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    const { data: productData, error: productError } = await supabase
      .from('credit_products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (productError || !productData) {
      throw new Error('Product not found');
    }

    console.log('Found product:', productData);

    // Create or retrieve Stripe customer
    let customerId: string;
    const { data: existingCustomers } = await stripe.customers.search({
      query: `metadata['whatsapp_number']:'${phone_number}'`,
    });

    if (existingCustomers && existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
    } else {
      const customer = await stripe.customers.create({
        metadata: {
          whatsapp_number: phone_number,
          user_id: userData.id,
        },
      });
      customerId = customer.id;
    }

    console.log('Customer ID:', customerId);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: productData.price,
      currency: productData.currency || 'usd',
      customer: customerId,
      metadata: {
        product_id: productData.id,
        credits_amount: productData.credits_amount,
        user_id: userData.id,
      },
    });

    console.log('Created payment intent:', paymentIntent.id);

    // Record the payment transaction
    const { error: transactionError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: userData.id,
        amount: productData.price,
        currency: productData.currency || 'usd',
        status: 'pending',
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: customerId,
        product_id: productData.id,
      });

    if (transactionError) {
      console.error('Error recording transaction:', transactionError);
      throw new Error('Failed to record transaction');
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        amount: productData.price,
        currency: productData.currency || 'usd',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
})
