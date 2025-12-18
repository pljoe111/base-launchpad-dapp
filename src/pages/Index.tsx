import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { CampaignCard } from "@/components/CampaignCard";
import { CampaignCardSkeleton } from "@/components/Skeleton";
import { useService } from "@/contexts/ServiceContext";
import type { Campaign } from "@/services/crowdfundService";
import { Input } from "@/components/ui/input";

export default function Index() {
  const { service, loading: serviceLoading } = useService();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!service || serviceLoading) return;

    const fetchCampaigns = async () => {
      setLoading(true);
      try {
        const data = await service.listCampaigns({
          publishedOnly: true,
          query: searchQuery || undefined,
        });
        setCampaigns(data);
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchCampaigns, 300);
    return () => clearTimeout(debounce);
  }, [service, serviceLoading, searchQuery]);

  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2">Discover Campaigns</h1>
          <p className="text-muted-foreground mb-4">
            Support innovative projects on Base
          </p>
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CampaignCardSkeleton key={i} />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">
              {searchQuery ? "No campaigns found matching your search." : "No campaigns yet. Be the first to create one!"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
