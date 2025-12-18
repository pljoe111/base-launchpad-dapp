import { Link, useNavigate } from "react-router-dom";
import { useService } from "@/contexts/ServiceContext";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { session, profile, service, loading } = useService();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    if (service) {
      await service.signOut();
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link to="/" className="font-semibold text-lg hover:text-primary transition-colors">
              crowdfund
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Discover
              </Link>
              {session && (
                <>
                  <Link to="/new" className="text-muted-foreground hover:text-foreground transition-colors">
                    Create
                  </Link>
                  <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                    Dashboard
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-20 h-8 skeleton-pulse" />
            ) : session ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  {profile?.username ?? "User"}
                </span>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign out
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" onClick={() => navigate("/auth")}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border py-6 mt-auto">
        <div className="container text-center text-sm text-muted-foreground">
          <p>Crowdfunding dApp MVP · Base / EVM</p>
        </div>
      </footer>
    </div>
  );
}
