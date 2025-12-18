import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { mnemonicToAccount } from "https://esm.sh/viem@2.21.54/accounts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_index } = await req.json();

    if (typeof campaign_index !== 'number') {
      console.error('Invalid campaign_index:', campaign_index);
      return new Response(
        JSON.stringify({ error: 'campaign_index must be a number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mnemonic = Deno.env.get('MNEMONIC');
    if (!mnemonic) {
      console.error('MNEMONIC not configured');
      return new Response(
        JSON.stringify({ error: 'Wallet derivation not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Deriving wallet for campaign_index: ${campaign_index}`);

    const account = mnemonicToAccount(mnemonic, { 
      addressIndex: campaign_index 
    });

    console.log(`Derived address: ${account.address}`);

    return new Response(
      JSON.stringify({ address: account.address }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error in derive-campaign-wallet:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
