import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useService } from "@/contexts/ServiceContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Wallet } from "@/services/crowdfundService";

export default function NewCampaign() {
  const { service, session, loading: serviceLoading } = useService();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [goalEth, setGoalEth] = useState("");
  const [minPledgeEth, setMinPledgeEth] = useState("0.001");
  const [deadlineDays, setDeadlineDays] = useState("30");

  useEffect(() => {
    if (!serviceLoading && !session) {
      navigate("/auth");
    }
  }, [serviceLoading, session, navigate]);

  useEffect(() => {
    if (!service || serviceLoading || !session) return;

    const fetchWallets = async () => {
      try {
        const data = await service.listMyWallets();
        setWallets(data);
      } catch (err) {
        console.error("Failed to fetch wallets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWallets();
  }, [service, serviceLoading, session]);

  useEffect(() => {
    // Auto-generate slug from title
    const generated = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
    setSlug(generated);
  }, [title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) return;

    const primaryWallet = wallets.find((w) => w.isPrimary) || wallets[0];
    if (!primaryWallet) {
      toast({
        title: "No wallet linked",
        description: "Please link a wallet in your dashboard first.",
        variant: "destructive",
      });
      return;
    }

    if (!title || !slug || !goalEth || !deadlineDays) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const goalAmountWei = (parseFloat(goalEth) * 1e18).toString();
      const minPledgeWei = (parseFloat(minPledgeEth) * 1e18).toString();
      const deadlineAt = new Date(
        Date.now() + parseInt(deadlineDays) * 24 * 60 * 60 * 1000
      ).toISOString();

      const campaign = await service.createDraftCampaign({
        title,
        slug,
        summary: summary || undefined,
        descriptionMd: description || undefined,
        coverImageUrl: coverUrl || undefined,
        creatorWalletAddress: primaryWallet.address,
        goalAmountWei,
        minPledgeWei,
        deadlineAt,
      });

      toast({ title: "Draft campaign created!" });
      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create campaign";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (serviceLoading || loading) {
    return (
      <Layout>
        <div className="container py-8 max-w-2xl">
          <div className="skeleton-pulse h-8 w-48 mb-6" />
          <div className="card-surface p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-pulse h-10 w-full" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (wallets.length === 0) {
    return (
      <Layout>
        <div className="container py-8 max-w-2xl">
          <h1 className="text-xl font-semibold mb-6">Create Campaign</h1>
          <div className="card-surface p-6 text-center">
            <p className="text-muted-foreground mb-4">
              You need to link a wallet before creating a campaign.
            </p>
            <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 max-w-2xl">
        <h1 className="text-xl font-semibold mb-6">Create Campaign</h1>

        <form onSubmit={handleSubmit} className="card-surface p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Awesome Project"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug *</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">/c/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-awesome-project"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Input
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="A brief description of your project"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Full Description (Markdown)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell your story..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverUrl">Cover Image URL</Label>
            <Input
              id="coverUrl"
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="goalEth">Goal Amount (ETH) *</Label>
              <Input
                id="goalEth"
                type="number"
                value={goalEth}
                onChange={(e) => setGoalEth(e.target.value)}
                placeholder="1.0"
                step="0.001"
                min="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minPledgeEth">Min Pledge (ETH)</Label>
              <Input
                id="minPledgeEth"
                type="number"
                value={minPledgeEth}
                onChange={(e) => setMinPledgeEth(e.target.value)}
                step="0.001"
                min="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadlineDays">Duration (days) *</Label>
            <Input
              id="deadlineDays"
              type="number"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(e.target.value)}
              min="1"
              max="90"
              required
            />
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating..." : "Create Draft"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This creates a draft. You'll publish it from your dashboard.
            </p>
          </div>
        </form>
      </div>
    </Layout>
  );
}
