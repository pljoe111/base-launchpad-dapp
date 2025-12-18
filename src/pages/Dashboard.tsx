import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useService } from "@/contexts/ServiceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Campaign, Wallet } from "@/services/crowdfundService";

export default function Dashboard() {
  const { service, session, loading: serviceLoading } = useService();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [linkingWallet, setLinkingWallet] = useState(false);

  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [activeUpdateCampaign, setActiveUpdateCampaign] = useState<string | null>(null);
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateBody, setUpdateBody] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);

  useEffect(() => {
    if (!serviceLoading && !session) {
      navigate("/auth");
    }
  }, [serviceLoading, session, navigate]);

  useEffect(() => {
    if (!service || serviceLoading || !session) return;

    const fetchData = async () => {
      try {
        const [campaignsData, walletsData] = await Promise.all([
          service.listMyCampaigns(),
          service.listMyWallets(),
        ]);
        setCampaigns(campaignsData);
        setWallets(walletsData);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [service, serviceLoading, session]);

  const handleLinkWallet = async () => {
    if (!service || !newWalletAddress) return;

    if (!/^0x[a-fA-F0-9]{40}$/.test(newWalletAddress)) {
      toast({ title: "Invalid wallet address", variant: "destructive" });
      return;
    }

    setLinkingWallet(true);
    try {
      await service.linkWallet(newWalletAddress);
      const updated = await service.listMyWallets();
      setWallets(updated);
      setNewWalletAddress("");
      toast({ title: "Wallet linked successfully" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to link wallet";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLinkingWallet(false);
    }
  };

  const handleSetPrimary = async (walletId: number) => {
    if (!service) return;

    try {
      await service.setPrimaryWallet(walletId);
      const updated = await service.listMyWallets();
      setWallets(updated);
      toast({ title: "Primary wallet updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handlePublish = async (campaignId: string) => {
    if (!service) return;

    setPublishingId(campaignId);
    try {
      await service.publishCampaign(campaignId);
      const updated = await service.listMyCampaigns();
      setCampaigns(updated);
      toast({ title: "Campaign published!" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPublishingId(null);
    }
  };

  const handlePostUpdate = async (campaignId: string) => {
    if (!service || !updateBody.trim()) return;

    setPostingUpdate(true);
    try {
      await service.createUpdate(campaignId, {
        title: updateTitle || undefined,
        bodyMd: updateBody,
      });
      setUpdateTitle("");
      setUpdateBody("");
      setActiveUpdateCampaign(null);
      toast({ title: "Update posted!" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post update";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPostingUpdate(false);
    }
  };

  const handleCloseCampaign = async (campaignId: string) => {
    if (!service) return;
    if (!confirm("Are you sure you want to close this campaign early? This cannot be undone.")) return;

    setClosingId(campaignId);
    try {
      await service.closeCampaignEarly(campaignId);
      const updated = await service.listMyCampaigns();
      setCampaigns(updated);
      toast({ title: "Campaign closed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to close campaign";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setClosingId(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!service) return;
    if (!confirm("Are you sure you want to delete this campaign? This cannot be undone.")) return;

    setDeletingId(campaignId);
    try {
      await service.deleteCampaign(campaignId);
      const updated = await service.listMyCampaigns();
      setCampaigns(updated);
      toast({ title: "Campaign deleted" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete campaign";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const formatEth = (wei: string) => {
    const eth = Number(wei) / 1e18;
    return eth.toFixed(eth < 1 ? 4 : 2);
  };

  if (serviceLoading || loading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="skeleton-pulse h-8 w-32 mb-6" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="skeleton-pulse h-6 w-24" />
              <div className="card-surface p-4 space-y-3">
                <div className="skeleton-pulse h-10 w-full" />
                <div className="skeleton-pulse h-10 w-full" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="skeleton-pulse h-6 w-32" />
              <div className="card-surface p-4">
                <div className="skeleton-pulse h-20 w-full" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        <h1 className="text-xl font-semibold mb-6">Dashboard</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Wallets Section */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-medium mb-4">Wallets</h2>
            <div className="card-surface p-4 space-y-4">
              {wallets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No wallets linked yet.</p>
              ) : (
                <ul className="space-y-2">
                  {wallets.map((wallet) => (
                    <li
                      key={wallet.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-mono truncate max-w-[180px]">
                        {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                      </span>
                      <div className="flex items-center gap-2">
                        {wallet.isPrimary ? (
                          <span className="text-xs text-primary">Primary</span>
                        ) : (
                          <button
                            onClick={() => handleSetPrimary(wallet.id)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Set primary
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pt-2 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    placeholder="0x..."
                    value={newWalletAddress}
                    onChange={(e) => setNewWalletAddress(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleLinkWallet}
                    disabled={linkingWallet || !newWalletAddress}
                  >
                    {linkingWallet ? "..." : "Link"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Campaigns Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">My Campaigns</h2>
              <Button size="sm" onClick={() => navigate("/new")}>
                + New Campaign
              </Button>
            </div>

            {campaigns.length === 0 ? (
              <div className="card-surface p-6 text-center">
                <p className="text-muted-foreground mb-4">
                  You haven't created any campaigns yet.
                </p>
                <Button onClick={() => navigate("/new")}>Create your first campaign</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="card-surface p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/c/${campaign.slug}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {campaign.title}
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1">
                          Goal: {formatEth(campaign.goalAmountWei)} ETH
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              campaign.isPublished
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {campaign.isPublished ? "Published" : "Draft"}
                          </span>
                          {campaign.isPublished && new Date(campaign.deadlineAt) < new Date() && (
                            <span className="text-xs px-2 py-0.5 rounded bg-destructive/20 text-destructive">
                              Ended
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {!campaign.isPublished && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handlePublish(campaign.id)}
                              disabled={publishingId === campaign.id}
                            >
                              {publishingId === campaign.id ? "Publishing..." : "Publish"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteCampaign(campaign.id)}
                              disabled={deletingId === campaign.id}
                            >
                              {deletingId === campaign.id ? "Deleting..." : "Delete"}
                            </Button>
                          </>
                        )}
                        {campaign.isPublished && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setActiveUpdateCampaign(
                                  activeUpdateCampaign === campaign.id ? null : campaign.id
                                )
                              }
                            >
                              {activeUpdateCampaign === campaign.id ? "Cancel" : "Post Update"}
                            </Button>
                            {new Date(campaign.deadlineAt) > new Date() && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCloseCampaign(campaign.id)}
                                disabled={closingId === campaign.id}
                              >
                                {closingId === campaign.id ? "Closing..." : "Close Early"}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {activeUpdateCampaign === campaign.id && (
                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                        <Input
                          placeholder="Update title (optional)"
                          value={updateTitle}
                          onChange={(e) => setUpdateTitle(e.target.value)}
                        />
                        <Textarea
                          placeholder="What's new with your project?"
                          value={updateBody}
                          onChange={(e) => setUpdateBody(e.target.value)}
                          rows={3}
                        />
                        <Button
                          size="sm"
                          onClick={() => handlePostUpdate(campaign.id)}
                          disabled={postingUpdate || !updateBody.trim()}
                        >
                          {postingUpdate ? "Posting..." : "Post Update"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
