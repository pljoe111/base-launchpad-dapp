-- Rename creator_wallet_address to campaign_deposit_address
ALTER TABLE public.campaigns 
  RENAME COLUMN creator_wallet_address TO campaign_deposit_address;

-- Remove campaign_contract_address (no longer needed)
ALTER TABLE public.campaigns 
  DROP COLUMN IF EXISTS campaign_contract_address;

-- Add campaign_index as auto-increment SERIAL
ALTER TABLE public.campaigns 
  ADD COLUMN campaign_index SERIAL;