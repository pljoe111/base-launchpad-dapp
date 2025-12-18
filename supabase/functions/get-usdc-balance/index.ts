import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// USDC on Base mainnet (6 decimals)
const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_RPC_URL = "https://mainnet.base.org";

// ERC20 balanceOf(address) function selector
const BALANCE_OF_SELECTOR = "0x70a08231";

async function getUSDCBalance(walletAddress: string): Promise<string> {
  // Pad address to 32 bytes (remove 0x, pad left with zeros)
  const paddedAddress = walletAddress.slice(2).toLowerCase().padStart(64, "0");
  const data = BALANCE_OF_SELECTOR + paddedAddress;

  const response = await fetch(BASE_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: USDC_CONTRACT,
          data: data,
        },
        "latest",
      ],
    }),
  });

  const result = await response.json();
  
  if (result.error) {
    console.error("RPC error:", result.error);
    throw new Error(result.error.message || "RPC call failed");
  }

  // Result is hex string representing balance in smallest unit (6 decimals for USDC)
  const balanceHex = result.result;
  const balanceWei = BigInt(balanceHex).toString();
  
  return balanceWei;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress } = await req.json();

    if (!walletAddress || typeof walletAddress !== "string") {
      return new Response(
        JSON.stringify({ error: "walletAddress is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return new Response(
        JSON.stringify({ error: "Invalid wallet address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching USDC balance for ${walletAddress}`);
    const balance = await getUSDCBalance(walletAddress);
    console.log(`Balance: ${balance} (raw units, 6 decimals)`);

    return new Response(
      JSON.stringify({ 
        balance,
        decimals: 6,
        currency: "USDC"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching balance:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch balance";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
