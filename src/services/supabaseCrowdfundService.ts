import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import type {
  CrowdfundService,
  ChainAdapter,
  Profile,
  Wallet,
  Campaign,
  CampaignDraftInput,
  CampaignUpdate,
  OnchainCampaignState,
} from "./crowdfundService";

function mapProfile(row: {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

function mapWallet(row: {
  id: number;
  user_id: string;
  address: string;
  chain_id: number;
  is_primary: boolean;
  created_at: string;
}): Wallet {
  return {
    id: row.id,
    userId: row.user_id,
    address: row.address,
    chainId: row.chain_id,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  };
}

function mapCampaign(row: {
  id: string;
  creator_user_id: string;
  campaign_index: number;
  campaign_deposit_address: string;
  title: string;
  slug: string;
  summary: string | null;
  description_md: string | null;
  cover_image_url: string | null;
  chain_id: number;
  currency_address: string;
  goal_amount_wei: number;
  min_pledge_wei: number;
  deadline_at: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}): Campaign {
  return {
    id: row.id,
    creatorUserId: row.creator_user_id,
    campaignIndex: row.campaign_index,
    campaignDepositAddress: row.campaign_deposit_address,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    descriptionMd: row.description_md,
    coverImageUrl: row.cover_image_url,
    chainId: row.chain_id,
    currencyAddress: row.currency_address,
    goalAmountWei: row.goal_amount_wei.toString(),
    minPledgeWei: row.min_pledge_wei.toString(),
    deadlineAt: row.deadline_at,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCampaignUpdate(row: {
  id: number;
  campaign_id: string;
  author_user_id: string;
  title: string | null;
  body_md: string;
  created_at: string;
}): CampaignUpdate {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    authorUserId: row.author_user_id,
    title: row.title,
    bodyMd: row.body_md,
    createdAt: row.created_at,
  };
}

export function createSupabaseCrowdfundService(chainAdapter: ChainAdapter): CrowdfundService {
  return {
    // ============= AUTH =============

    async getSession(): Promise<Session | null> {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },

    async signIn(email: string, password?: string): Promise<void> {
      if (password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      }
    },

    async signUp(email: string, password: string, username: string): Promise<void> {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { username },
        },
      });
      if (error) throw error;
    },

    async signOut(): Promise<void> {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },

    async getProfile(): Promise<Profile | null> {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sessionData.session.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return mapProfile(data);
    },

    onAuthStateChange(callback: (session: Session | null) => void): () => void {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
        callback(session);
      });
      return () => subscription.unsubscribe();
    },

    // ============= WALLETS =============

    async listMyWallets(): Promise<Wallet[]> {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []).map(mapWallet);
    },

    async linkWallet(address: string): Promise<void> {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) throw new Error("Not authenticated");

      const { error } = await supabase.from("wallets").insert({
        user_id: sessionData.session.user.id,
        address: address.toLowerCase(),
      });

      if (error) throw error;
    },

    async setPrimaryWallet(walletId: number): Promise<void> {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) throw new Error("Not authenticated");

      // First, unset all primary wallets
      const { error: unsetError } = await supabase
        .from("wallets")
        .update({ is_primary: false })
        .eq("user_id", sessionData.session.user.id);

      if (unsetError) throw unsetError;

      // Then set the selected one as primary
      const { error: setError } = await supabase
        .from("wallets")
        .update({ is_primary: true })
        .eq("id", walletId);

      if (setError) throw setError;
    },

    // ============= CAMPAIGNS =============

    async listCampaigns(params: { publishedOnly: boolean; query?: string }): Promise<Campaign[]> {
      let queryBuilder = supabase.from("campaigns").select("*");

      if (params.publishedOnly) {
        queryBuilder = queryBuilder.eq("is_published", true);
      }

      if (params.query) {
        queryBuilder = queryBuilder.ilike("title", `%${params.query}%`);
      }

      const { data, error } = await queryBuilder.order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(mapCampaign);
    },

    async listMyCampaigns(): Promise<Campaign[]> {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) return [];

      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("creator_user_id", sessionData.session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(mapCampaign);
    },

    async getCampaignBySlug(slug: string): Promise<Campaign | null> {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return mapCampaign(data);
    },

    async createDraftCampaign(input: CampaignDraftInput): Promise<Campaign> {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) throw new Error("Not authenticated");

      // 1. Insert campaign with placeholder deposit address (will be updated after deriving)
      const { data, error } = await supabase
        .from("campaigns")
        .insert([{
          creator_user_id: sessionData.session.user.id,
          campaign_deposit_address: "0x0000000000000000000000000000000000000000", // placeholder
          title: input.title,
          slug: input.slug.toLowerCase().replace(/\s+/g, "-"),
          summary: input.summary ?? null,
          description_md: input.descriptionMd ?? null,
          cover_image_url: input.coverImageUrl ?? null,
          goal_amount_wei: parseFloat(input.goalAmountWei),
          min_pledge_wei: parseFloat(input.minPledgeWei ?? "1000000000000000"),
          deadline_at: input.deadlineAt,
          currency_address: input.currencyAddress ?? "0x0000000000000000000000000000000000000000",
          is_published: false,
        }])
        .select()
        .single();

      if (error) throw error;

      // 2. Call edge function to derive wallet from campaign_index
      const { data: walletData, error: walletError } = await supabase.functions.invoke(
        'derive-campaign-wallet',
        { body: { campaign_index: data.campaign_index } }
      );

      if (walletError) {
        console.error('Failed to derive campaign wallet:', walletError);
        // Don't fail the campaign creation, but log the error
        return mapCampaign(data);
      }

      // 3. Update campaign with derived address
      const { data: updatedData, error: updateError } = await supabase
        .from("campaigns")
        .update({ campaign_deposit_address: walletData.address })
        .eq("id", data.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update campaign deposit address:', updateError);
        return mapCampaign(data);
      }

      return mapCampaign(updatedData);
    },

    async updateDraftCampaign(id: string, patch: Partial<CampaignDraftInput>): Promise<Campaign> {
      const updateData: Record<string, unknown> = {};

      if (patch.title !== undefined) updateData.title = patch.title;
      if (patch.slug !== undefined) updateData.slug = patch.slug.toLowerCase().replace(/\s+/g, "-");
      if (patch.summary !== undefined) updateData.summary = patch.summary;
      if (patch.descriptionMd !== undefined) updateData.description_md = patch.descriptionMd;
      if (patch.coverImageUrl !== undefined) updateData.cover_image_url = patch.coverImageUrl;
      if (patch.goalAmountWei !== undefined) updateData.goal_amount_wei = patch.goalAmountWei;
      if (patch.minPledgeWei !== undefined) updateData.min_pledge_wei = patch.minPledgeWei;
      if (patch.deadlineAt !== undefined) updateData.deadline_at = patch.deadlineAt;
      if (patch.currencyAddress !== undefined) updateData.currency_address = patch.currencyAddress;

      const { data, error } = await supabase
        .from("campaigns")
        .update(updateData)
        .eq("id", id)
        .eq("is_published", false)
        .select()
        .single();

      if (error) throw error;
      return mapCampaign(data);
    },

    async publishCampaign(id: string): Promise<Campaign> {
      // Wallet address is already assigned at creation, just publish
      const { data, error } = await supabase
        .from("campaigns")
        .update({ is_published: true })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapCampaign(data);
    },

    async closeCampaignEarly(id: string): Promise<Campaign> {
      const { data, error } = await supabase
        .from("campaigns")
        .update({
          deadline_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapCampaign(data);
    },

    async deleteCampaign(id: string): Promise<void> {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },

    // ============= UPDATES =============

    async listUpdates(campaignId: string): Promise<CampaignUpdate[]> {
      const { data, error } = await supabase
        .from("campaign_updates")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(mapCampaignUpdate);
    },

    async createUpdate(campaignId: string, input: { title?: string; bodyMd: string }): Promise<CampaignUpdate> {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("campaign_updates")
        .insert({
          campaign_id: campaignId,
          author_user_id: sessionData.session.user.id,
          title: input.title ?? null,
          body_md: input.bodyMd,
        })
        .select()
        .single();

      if (error) throw error;
      return mapCampaignUpdate(data);
    },

    // ============= ON-CHAIN (delegated) =============

    getOnchainCampaignState(input): Promise<OnchainCampaignState> {
      return chainAdapter.getOnchainCampaignState(input);
    },

    getUserContribution(input): Promise<{ amountUsdc: string }> {
      return chainAdapter.getUserContribution(input);
    },

    claimRefund(input): Promise<{ txHash: string }> {
      return chainAdapter.claimRefund(input);
    },

    finalize(input): Promise<{ txHash: string }> {
      return chainAdapter.finalize(input);
    },

    getWalletUsdcBalance(walletAddress: string): Promise<string> {
      return chainAdapter.getWalletUsdcBalance(walletAddress);
    },
  };
}
