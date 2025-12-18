-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create wallets table
CREATE TABLE public.wallets (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  address text NOT NULL,
  chain_id int NOT NULL DEFAULT 8453,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, address),
  UNIQUE (user_id, address)
);

-- Create campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_wallet_address text NOT NULL,
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  summary text,
  description_md text,
  cover_image_url text,
  chain_id int NOT NULL DEFAULT 8453,
  campaign_contract_address text,
  currency_address text NOT NULL DEFAULT '0x0000000000000000000000000000000000000000',
  goal_amount_wei numeric(78,0) NOT NULL,
  min_pledge_wei numeric(78,0) NOT NULL DEFAULT 1000000000000000,
  deadline_at timestamptz NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create campaign_updates table
CREATE TABLE public.campaign_updates (
  id bigserial PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  body_md text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_updates ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Wallets RLS policies (owner only)
CREATE POLICY "Users can view their own wallets"
ON public.wallets FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallets"
ON public.wallets FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallets"
ON public.wallets FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wallets"
ON public.wallets FOR DELETE
USING (auth.uid() = user_id);

-- Campaigns RLS policies
CREATE POLICY "Published campaigns are viewable by everyone"
ON public.campaigns FOR SELECT
USING (is_published = true OR auth.uid() = creator_user_id);

CREATE POLICY "Authenticated users can create campaigns"
ON public.campaigns FOR INSERT
WITH CHECK (auth.uid() = creator_user_id);

CREATE POLICY "Creators can update their own campaigns"
ON public.campaigns FOR UPDATE
USING (auth.uid() = creator_user_id);

CREATE POLICY "Creators can delete their own unpublished campaigns"
ON public.campaigns FOR DELETE
USING (auth.uid() = creator_user_id AND is_published = false);

-- Campaign updates RLS policies
CREATE POLICY "Updates for published campaigns are viewable"
ON public.campaign_updates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
    AND (c.is_published = true OR c.creator_user_id = auth.uid())
  )
);

CREATE POLICY "Campaign creators can post updates"
ON public.campaign_updates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_id
    AND c.creator_user_id = auth.uid()
  )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for campaigns updated_at
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
    NEW.raw_user_meta_data ->> 'display_name'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();