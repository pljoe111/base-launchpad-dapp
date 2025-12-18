import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Layout } from "@/components/Layout";
import { RefundModal } from "@/components/RefundModal";
import { Skeleton } from "@/components/Skeleton";
import { useService } from "@/contexts/ServiceContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { USDC_DECIMALS } from "@/services/crowdfundService";
import type { Campaign, CampaignUpdate, OnchainCampaignState } from "@/services/crowdfundService";

const POLLING_INTERVAL = 5000; // 5 seconds

export default function CampaignDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { service, session, profile, loading: serviceLoading } = useService();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [chainState, setChainState] = useState<OnchainCampaignState | null>(null);
  const [updates, setUpdates] = useState<CampaignUpdate[]>([]);
  const [userContribution, setUserContribution] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string>("0");
  const [isPolling, setIsPolling] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const previousBalanceRef = useRef<string>("0");

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
            goalAmountUsdc: campaignData.goalAmountWei, // Using Wei field for USDC amount
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
              setUserContribution(contrib.amountUsdc);
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

  // Poll wallet balance for incoming USDC
  const pollBalance = useCallback(async () => {
    if (!service || !campaign?.campaignContractAddress) return;

    try {
      const balance = await service.getWalletUsdcBalance(campaign.campaignContractAddress);
      setWalletBalance(balance);

      // Check if balance increased (new pledge detected)
      const prevBalance = BigInt(previousBalanceRef.current || "0");
      const newBalance = BigInt(balance);

      if (newBalance > prevBalance && prevBalance > BigInt(0)) {
        const diff = newBalance - prevBalance;
        const diffUsdc = Number(diff) / Math.pow(10, USDC_DECIMALS);
        toast({
          title: "New pledge received!",
          description: `+$${diffUsdc.toFixed(2)} USDC`,
        });
        // Refresh chain state
        fetchData();
      }

      previousBalanceRef.current = balance;
    } catch (err) {
      console.error("Failed to poll balance:", err);
    }
  }, [service, campaign?.campaignContractAddress, toast, fetchData]);

  // Start/stop polling
  useEffect(() => {
    if (campaign?.isPublished && campaign.campaignContractAddress && chainState?.status === "LIVE") {
      setIsPolling(true);
      // Initial fetch
      pollBalance();
      // Set up interval
      pollingRef.current = setInterval(pollBalance, POLLING_INTERVAL);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setIsPolling(false);
    };
  }, [campaign?.isPublished, campaign?.campaignContractAddress, chainState?.status, pollBalance]);

  useEffect(() => {
    if (!serviceLoading) {
      fetchData();
    }
  }, [serviceLoading, fetchData]);

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

  const formatUsdc = (amount: string) => {
    const usdc = Number(amount) / Math.pow(10, USDC_DECIMALS);
    return usdc.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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
    ? Math.min(100, (Number(chainState.totalRaisedUsdc) / Number(campaign.goalAmountWei)) * 100)
    : 0;

  const canRefund =
    chainState?.status === "FAILED" &&
    Number(userContribution) > 0;

  const canFinalize =
    isCreator &&
    chainState?.status === "SUCCESSFUL" &&
    !chainState.isFinalized;

  // Generate QR code data - just the wallet address
  const qrData = campaign.campaignContractAddress || "";

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
                        ${formatUsdc(chainState.totalRaisedUsdc)} USDC
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Goal</span>
                      <span className="font-mono">
                        ${formatUsdc(campaign.goalAmountWei)} USDC
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
                  Min pledge: ${formatUsdc(campaign.minPledgeWei)} USDC
                </p>
              </div>

              {Number(userContribution) > 0 && (
                <div className="text-sm bg-muted p-3 rounded mb-4">
                  <span className="text-muted-foreground">Your pledge: </span>
                  <span className="font-mono">${formatUsdc(userContribution)} USDC</span>
                </div>
              )}

              {/* QR Code for pledging */}
              {campaign.isPublished && campaign.campaignContractAddress && chainState?.status === "LIVE" && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm font-medium mb-3">Send USDC to pledge</p>
                    <div className="bg-white p-4 rounded-lg inline-block">
                      <QRCodeSVG
                        value={qrData}
                        size={180}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-2">Campaign wallet address</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded break-all block">
                      {campaign.campaignContractAddress}
                    </code>
                  </div>

                  <div className="text-center text-xs text-muted-foreground">
                    <p className="flex items-center justify-center gap-2">
                      {isPolling && (
                        <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse" />
                      )}
                      Auto-refreshing every 5s
                    </p>
                    {walletBalance !== "0" && (
                      <p className="mt-1">
                        Wallet balance: ${formatUsdc(walletBalance)} USDC
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Send USDC on Base network only
                  </p>
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

              {!campaign.isPublished && (
                <p className="text-sm text-muted-foreground text-center">
                  This campaign is not published yet
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
