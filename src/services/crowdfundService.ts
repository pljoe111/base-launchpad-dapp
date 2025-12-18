import type { Session, User } from "@supabase/supabase-js";

// ============= SHARED TYPES =============

export interface Profile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Wallet {
  id: number;
  userId: string;
  address: string;
  chainId: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  creatorUserId: string;
  campaignIndex: number;
  campaignDepositAddress: string;
  title: string;
  slug: string;
  summary: string | null;
  descriptionMd: string | null;
  coverImageUrl: string | null;
  chainId: number;
  currencyAddress: string;
  goalAmountWei: string;
  minPledgeWei: string;
  deadlineAt: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDraftInput {
  title: string;
  slug: string;
  summary?: string;
  descriptionMd?: string;
  coverImageUrl?: string;
  goalAmountWei: string;
  minPledgeWei?: string;
  deadlineAt: string;
  currencyAddress?: string;
}

export interface CampaignUpdate {
  id: number;
  campaignId: string;
  authorUserId: string;
  title: string | null;
  bodyMd: string;
  createdAt: string;
}

export type CampaignStatus = "LIVE" | "SUCCESSFUL" | "FAILED" | "FINALIZED";

export interface OnchainCampaignState {
  totalRaisedUsdc: string; // 6 decimals
  status: CampaignStatus;
  isFinalized: boolean;
  backerCount: number;
}

// USDC has 6 decimals
export const USDC_DECIMALS = 6;
export const USDC_CONTRACT_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// ============= CHAIN ADAPTER INTERFACE =============

export interface ChainAdapter {
  getOnchainCampaignState(input: {
    chainId: number;
    campaignDepositAddress: string;
    currencyAddress: string;
    goalAmountUsdc: string;
    deadlineAt: string;
  }): Promise<OnchainCampaignState>;

  getUserContribution(input: {
    campaignDepositAddress: string;
    userWalletAddress: string;
  }): Promise<{ amountUsdc: string }>;

  // Pledge removed - now done via direct USDC transfers

  claimRefund(input: {
    campaignDepositAddress: string;
    fromAddress: string;
  }): Promise<{ txHash: string }>;

  finalize(input: {
    campaignDepositAddress: string;
    fromAddress: string;
  }): Promise<{ txHash: string }>;

  // Poll balance via edge function
  getWalletUsdcBalance(walletAddress: string): Promise<string>;
}

// ============= SERVICE INTERFACE =============

export interface CrowdfundService {
  // Auth
  getSession(): Promise<Session | null>;
  signIn(email: string, password?: string): Promise<void>;
  signUp(email: string, password: string, username: string): Promise<void>;
  signOut(): Promise<void>;
  getProfile(): Promise<Profile | null>;
  onAuthStateChange(callback: (session: Session | null) => void): () => void;

  // Wallets
  listMyWallets(): Promise<Wallet[]>;
  linkWallet(address: string): Promise<void>;
  setPrimaryWallet(walletId: number): Promise<void>;

  // Campaigns
  listCampaigns(params: { publishedOnly: boolean; query?: string }): Promise<Campaign[]>;
  listMyCampaigns(): Promise<Campaign[]>;
  getCampaignBySlug(slug: string): Promise<Campaign | null>;
  createDraftCampaign(input: CampaignDraftInput): Promise<Campaign>;
  updateDraftCampaign(id: string, patch: Partial<CampaignDraftInput>): Promise<Campaign>;
  publishCampaign(id: string): Promise<Campaign>;
  closeCampaignEarly(id: string): Promise<Campaign>;
  deleteCampaign(id: string): Promise<void>;

  // Updates
  listUpdates(campaignId: string): Promise<CampaignUpdate[]>;
  createUpdate(campaignId: string, input: { title?: string; bodyMd: string }): Promise<CampaignUpdate>;

  // On-chain (delegated to ChainAdapter)
  getOnchainCampaignState(input: {
    chainId: number;
    campaignDepositAddress: string;
    currencyAddress: string;
    goalAmountUsdc: string;
    deadlineAt: string;
  }): Promise<OnchainCampaignState>;

  getUserContribution(input: {
    campaignDepositAddress: string;
    userWalletAddress: string;
  }): Promise<{ amountUsdc: string }>;

  // Pledge removed - users send USDC directly to campaign wallet

  claimRefund(input: {
    campaignDepositAddress: string;
    fromAddress: string;
  }): Promise<{ txHash: string }>;

  finalize(input: {
    campaignDepositAddress: string;
    fromAddress: string;
  }): Promise<{ txHash: string }>;

  // Balance polling
  getWalletUsdcBalance(walletAddress: string): Promise<string>;
}

// ============= TOGGLE =============

const USE_MOCK_CHAIN = true;

// ============= FACTORY =============

let serviceInstance: CrowdfundService | null = null;

export async function getCrowdfundService(): Promise<CrowdfundService> {
  if (!serviceInstance) {
    const { createSupabaseCrowdfundService } = await import("./supabaseCrowdfundService");
    const { createMockChainAdapter } = await import("./mockChainAdapter");

    let chainAdapter: ChainAdapter;

    if (USE_MOCK_CHAIN) {
      chainAdapter = createMockChainAdapter();
    } else {
      // Future: import real chain adapter
      chainAdapter = createMockChainAdapter();
    }

    serviceInstance = createSupabaseCrowdfundService(chainAdapter);
  }

  return serviceInstance;
}
