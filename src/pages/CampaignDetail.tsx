import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RefundModal } from "@/components/RefundModal";
import { Skeleton } from "@/components/Skeleton";
import { useService } from "@/contexts/ServiceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Campaign, CampaignUpdate, OnchainCampaignState } from "@/services/crowdfundService";

export default function CampaignDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { service, session, profile, loading: serviceLoading } = useService();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [chainState, setChainState] = useState<OnchainCampaignState | null>(null);
  const [updates, setUpdates] = useState<CampaignUpdate[]>([]);
  const [userContribution, setUserContribution] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [pledgeAmount, setPledgeAmount] = useState("");
  const [pledging, setPledging] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const isCreator = campaign && profile && campaign.creatorUserId === profile.id;

  const fetchData = useCallback(async () => {
    if (!service || !slug) return;

    setLoading(true);
    try {
      const campaignData = await service.getCampaignBySlug(slug);
      setCampaign(campaignData);

      if (campaignData) {
        const updatesData = await service.listUpdates(campaignData.id);
        setUpdates(updatesData);

        if (campaignData.isPublished && campaignData.campaignContractAddress) {
          const state = await service.getOnchainCampaignState({
            chainId: campaignData.chainId,
            campaignContractAddress: campaignData.campaignContractAddress,
            currencyAddress: campaignData.currencyAddress,
            goalAmountWei: campaignData.goalAmountWei,
            deadlineAt: campaignData.deadlineAt,
          });
          setChainState(state);

          // Get user contribution if they have a linked wallet
          if (session) {
            const wallets = await service.listMyWallets();
            const primaryWallet = wallets.find((w) => w.isPrimary) || wallets[0];
            if (primaryWallet) {
              const contrib = await service.getUserContribution({
                campaignContractAddress: campaignData.campaignContractAddress,
                userWalletAddress: primaryWallet.address,
              });
              setUserContribution(contrib.amountWei);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch campaign:", err);
    } finally {
      setLoading(false);
    }
  }, [service, slug, session]);

  useEffect(() => {
    if (!serviceLoading) {
      fetchData();
    }
  }, [serviceLoading, fetchData]);

  const handlePledge = async () => {
    if (!service || !campaign || !campaign.campaignContractAddress || !pledgeAmount) return;

    const wallets = await service.listMyWallets();
    const primaryWallet = wallets.find((w) => w.isPrimary) || wallets[0];

    if (!primaryWallet) {
      toast({
        title: "No wallet linked",
        description: "Please link a wallet in your dashboard first.",
        variant: "destructive",
      });
      return;
    }

    setPledging(true);
    try {
      const amountWei = (parseFloat(pledgeAmount) * 1e18).toString();
      const { txHash } = await service.pledge({
        campaignContractAddress: campaign.campaignContractAddress,
        fromAddress: primaryWallet.address,
        amountWei,
        minPledgeWei: campaign.minPledgeWei,
        deadlineAt: campaign.deadlineAt,
      });

      toast({
        title: "Pledge successful!",
        description: `Transaction: ${txHash.slice(0, 10)}...`,
      });

      setPledgeAmount("");
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pledge failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPledging(false);
    }
  };

  const handleFinalize = async () => {
    if (!service || !campaign || !campaign.campaignContractAddress) return;

    const wallets = await service.listMyWallets();
    const primaryWallet = wallets.find((w) => w.isPrimary) || wallets[0];

    if (!primaryWallet) {
      toast({ title: "No wallet linked", variant: "destructive" });
      return;
    }

    setFinalizing(true);
    try {
      const { txHash } = await service.finalize({
        campaignContractAddress: campaign.campaignContractAddress,
        fromAddress: primaryWallet.address,
      });

      toast({
        title: "Campaign finalized!",
        description: `Transaction: ${txHash.slice(0, 10)}...`,
      });

      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Finalize failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setFinalizing(false);
    }
  };

  const formatEth = (wei: string) => {
    const eth = Number(wei) / 1e18;
    return eth.toFixed(eth < 1 ? 4 : 2);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-8 max-w-4xl">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="aspect-video rounded-lg mb-6" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-xl font-semibold mb-2">Campaign not found</h1>
          <p className="text-muted-foreground mb-4">
            This campaign doesn't exist or has been removed.
          </p>
          <Link to="/" className="text-primary hover:underline">
            Back to discover
          </Link>
        </div>
      </Layout>
    );
  }

  const progress = chainState
    ? Math.min(100, (Number(chainState.totalRaisedWei) / Number(campaign.goalAmountWei)) * 100)
    : 0;

  const canPledge =
    campaign.isPublished &&
    chainState?.status === "LIVE" &&
    session;

  const canRefund =
    chainState?.status === "FAILED" &&
    Number(userContribution) > 0;

  const canFinalize =
    isCreator &&
    chainState?.status === "SUCCESSFUL" &&
    !chainState.isFinalized;

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        <div className="mb-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to campaigns
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {campaign.coverImageUrl ? (
              <img
                src={campaign.coverImageUrl}
                alt={campaign.title}
                className="w-full aspect-video object-cover rounded-lg mb-6"
              />
            ) : (
              <div className="w-full aspect-video bg-muted rounded-lg mb-6 flex items-center justify-center">
                <span className="text-muted-foreground">No cover image</span>
              </div>
            )}

            <h1 className="text-2xl font-semibold mb-2">{campaign.title}</h1>

            {campaign.summary && (
              <p className="text-muted-foreground mb-4">{campaign.summary}</p>
            )}

            {campaign.descriptionMd && (
              <div className="prose prose-invert prose-sm max-w-none mt-6">
                <div className="whitespace-pre-wrap">{campaign.descriptionMd}</div>
              </div>
            )}

            {updates.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-medium mb-4">Updates</h2>
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div key={update.id} className="card-surface p-4">
                      {update.title && (
                        <h3 className="font-medium mb-1">{update.title}</h3>
                      )}
                      <p className="text-sm text-muted-foreground mb-2">
                        {formatDate(update.createdAt)}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{update.bodyMd}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="card-surface p-5 sticky top-20">
              {chainState && (
                <>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Raised</span>
                      <span className="font-mono">
                        {formatEth(chainState.totalRaisedWei)} ETH
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Goal</span>
                      <span className="font-mono">
                        {formatEth(campaign.goalAmountWei)} ETH
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-muted-foreground">
                      {chainState.backerCount} backers
                    </span>
                    <span
                      className={
                        chainState.status === "LIVE"
                          ? "text-primary"
                          : chainState.status === "SUCCESSFUL" || chainState.status === "FINALIZED"
                          ? "text-green-500"
                          : "text-destructive"
                      }
                    >
                      {chainState.status}
                    </span>
                  </div>
                </>
              )}

              <div className="text-sm text-muted-foreground mb-4">
                <p>Deadline: {formatDate(campaign.deadlineAt)}</p>
                <p className="mt-1">
                  Min pledge: {formatEth(campaign.minPledgeWei)} ETH
                </p>
              </div>

              {Number(userContribution) > 0 && (
                <div className="text-sm bg-muted p-3 rounded mb-4">
                  <span className="text-muted-foreground">Your pledge: </span>
                  <span className="font-mono">{formatEth(userContribution)} ETH</span>
                </div>
              )}

              {canPledge && (
                <div className="space-y-3">
                  <Input
                    type="number"
                    placeholder="Amount in ETH"
                    value={pledgeAmount}
                    onChange={(e) => setPledgeAmount(e.target.value)}
                    step="0.001"
                    min="0"
                  />
                  <Button
                    className="w-full"
                    onClick={handlePledge}
                    disabled={pledging || !pledgeAmount}
                  >
                    {pledging ? "Processing..." : "Pledge"}
                  </Button>
                </div>
              )}

              {canRefund && (
                <Button
                  variant="outline"
                  className="w-full mt-3"
                  onClick={() => setShowRefundModal(true)}
                >
                  Request Refund
                </Button>
              )}

              {canFinalize && (
                <Button
                  className="w-full mt-3"
                  onClick={handleFinalize}
                  disabled={finalizing}
                >
                  {finalizing ? "Finalizing..." : "Finalize Campaign"}
                </Button>
              )}

              {!session && chainState?.status === "LIVE" && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  <Link to="/auth" className="text-primary hover:underline">
                    Sign in
                  </Link>{" "}
                  to pledge
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <RefundModal open={showRefundModal} onClose={() => setShowRefundModal(false)} />
    </Layout>
  );
}
