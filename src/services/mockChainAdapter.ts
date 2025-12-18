import type { ChainAdapter, OnchainCampaignState, CampaignStatus } from "./crowdfundService";

interface MockCampaignState {
  totalRaisedWei: bigint;
  backerCount: number;
  contributions: Map<string, bigint>;
  isFinalized: boolean;
}

// In-memory state per campaign
const campaignStates = new Map<string, MockCampaignState>();

function getOrCreateState(address: string): MockCampaignState {
  if (!campaignStates.has(address)) {
    campaignStates.set(address, {
      totalRaisedWei: BigInt(0),
      backerCount: 0,
      contributions: new Map(),
      isFinalized: false,
    });
  }
  return campaignStates.get(address)!;
}

function deriveStatus(
  totalRaisedWei: bigint,
  goalAmountWei: bigint,
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

  if (totalRaisedWei >= goalAmountWei) {
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
      const goalAmountWei = BigInt(input.goalAmountWei);
      const deadlineAt = new Date(input.deadlineAt);

      const status = deriveStatus(
        state.totalRaisedWei,
        goalAmountWei,
        deadlineAt,
        state.isFinalized
      );

      return {
        totalRaisedWei: state.totalRaisedWei.toString(),
        status,
        isFinalized: state.isFinalized,
        backerCount: state.backerCount,
      };
    },

    async getUserContribution(input): Promise<{ amountWei: string }> {
      await simulateLatency();

      const state = getOrCreateState(input.campaignContractAddress);
      const contribution = state.contributions.get(input.userWalletAddress.toLowerCase()) ?? BigInt(0);

      return { amountWei: contribution.toString() };
    },

    async pledge(input): Promise<{ txHash: string }> {
      await simulateLatency();

      const amountWei = BigInt(input.amountWei);
      const minPledgeWei = BigInt(input.minPledgeWei);
      const deadlineAt = new Date(input.deadlineAt);
      const now = new Date();

      if (amountWei < minPledgeWei) {
        throw new Error(`Pledge amount must be at least ${minPledgeWei.toString()} wei`);
      }

      if (now >= deadlineAt) {
        throw new Error("Campaign deadline has passed");
      }

      const state = getOrCreateState(input.campaignContractAddress);
      const fromAddress = input.fromAddress.toLowerCase();

      const previousContribution = state.contributions.get(fromAddress) ?? BigInt(0);

      if (previousContribution === BigInt(0)) {
        state.backerCount += 1;
      }

      state.contributions.set(fromAddress, previousContribution + amountWei);
      state.totalRaisedWei += amountWei;

      return { txHash: generateTxHash() };
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
  };
}
