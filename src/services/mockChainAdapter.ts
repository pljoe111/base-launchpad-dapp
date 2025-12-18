import { supabase } from "@/integrations/supabase/client";
import type { ChainAdapter, OnchainCampaignState, CampaignStatus } from "./crowdfundService";

interface MockCampaignState {
  totalRaisedUsdc: bigint; // 6 decimals
  backerCount: number;
  contributions: Map<string, bigint>;
  isFinalized: boolean;
}

// In-memory state per campaign
const campaignStates = new Map<string, MockCampaignState>();

function getOrCreateState(address: string): MockCampaignState {
  if (!campaignStates.has(address)) {
    campaignStates.set(address, {
      totalRaisedUsdc: BigInt(0),
      backerCount: 0,
      contributions: new Map(),
      isFinalized: false,
    });
  }
  return campaignStates.get(address)!;
}

function deriveStatus(
  totalRaisedUsdc: bigint,
  goalAmountUsdc: bigint,
  deadlineAt: Date,
  isFinalized: boolean
): CampaignStatus {
  const now = new Date();

  if (isFinalized) {
    return "FINALIZED";
  }

  if (now < deadlineAt) {
    return "LIVE";
  }

  if (totalRaisedUsdc >= goalAmountUsdc) {
    return "SUCCESSFUL";
  }

  return "FAILED";
}

function generateTxHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function simulateLatency(): Promise<void> {
  const delay = 500 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export function createMockChainAdapter(): ChainAdapter {
  return {
    async getOnchainCampaignState(input): Promise<OnchainCampaignState> {
      await simulateLatency();

      const state = getOrCreateState(input.campaignContractAddress);
      const goalAmountUsdc = BigInt(input.goalAmountUsdc);
      const deadlineAt = new Date(input.deadlineAt);

      const status = deriveStatus(
        state.totalRaisedUsdc,
        goalAmountUsdc,
        deadlineAt,
        state.isFinalized
      );

      return {
        totalRaisedUsdc: state.totalRaisedUsdc.toString(),
        status,
        isFinalized: state.isFinalized,
        backerCount: state.backerCount,
      };
    },

    async getUserContribution(input): Promise<{ amountUsdc: string }> {
      await simulateLatency();

      const state = getOrCreateState(input.campaignContractAddress);
      const contribution = state.contributions.get(input.userWalletAddress.toLowerCase()) ?? BigInt(0);

      return { amountUsdc: contribution.toString() };
    },

    async claimRefund(): Promise<{ txHash: string }> {
      await simulateLatency();
      throw new Error("Refunds not implemented in MVP");
    },

    async finalize(input): Promise<{ txHash: string }> {
      await simulateLatency();

      const state = getOrCreateState(input.campaignContractAddress);

      if (state.isFinalized) {
        throw new Error("Campaign already finalized");
      }

      state.isFinalized = true;

      return { txHash: generateTxHash() };
    },

    async getWalletUsdcBalance(walletAddress: string): Promise<string> {
      // Call the edge function to get real USDC balance
      const { data, error } = await supabase.functions.invoke("get-usdc-balance", {
        body: { walletAddress },
      });

      if (error) {
        console.error("Error fetching USDC balance:", error);
        throw new Error("Failed to fetch USDC balance");
      }

      return data.balance;
    },
  };
}
