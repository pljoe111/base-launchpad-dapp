import { Link } from "react-router-dom";
import type { Campaign } from "@/services/crowdfundService";

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const deadlineDate = new Date(campaign.deadlineAt);
  const now = new Date();
  const isExpired = now >= deadlineDate;

  const daysLeft = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const formatEth = (wei: string) => {
    const eth = Number(wei) / 1e18;
    return eth.toFixed(eth < 1 ? 4 : 2);
  };

  return (
    <Link
      to={`/c/${campaign.slug}`}
      className="card-surface p-4 hover:bg-surface-hover transition-colors group block"
    >
      {campaign.coverImageUrl ? (
        <div className="aspect-video rounded overflow-hidden mb-3 bg-white">
          <img
            src={campaign.coverImageUrl}
            alt={campaign.title}
            className="w-full h-full object-contain"
          />
        </div>
      ) : (
        <div className="aspect-video rounded mb-3 bg-white flex items-center justify-center">
          <span className="text-muted-foreground text-sm">No image</span>
        </div>
      )}

      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
        {campaign.title}
      </h3>

      {campaign.summary && (
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          {campaign.summary}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Goal: <span className="text-foreground">{formatEth(campaign.goalAmountWei)} ETH</span>
        </span>
        <span className={isExpired ? "text-destructive" : "text-muted-foreground"}>
          {isExpired ? "Ended" : `${daysLeft}d left`}
        </span>
      </div>
    </Link>
  );
}
