import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SteelIcon } from "@/components/icons/SessionIcon";
import { GlobeIcon } from "@/components/icons/GlobeIcon";
import { ChromeIcon } from "@/components/icons/ChromeIcon";
import { getSessions, launchBrowserSession } from "@/steel-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: session, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { error, data } = await getSessions();
      if (error) throw error;
      return data;
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const sessionId = crypto.randomUUID();
      const { error, data } = await launchBrowserSession({
        body: {
          sessionId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate(`/sessions/${data?.id}`);
    },
    onError: (error) => {
      console.error("Failed to create session:", error);
    },
  });

  const handleCreateSession = () => {
    createSessionMutation.mutate();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary text-primary-foreground p-4">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Mises Browser Automator
          </h1>
          <p className="text-xl text-muted-foreground">
            High efficiency & Low cost browser API for AI agents and applications
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-[var(--gray-3)]">
            <div className="w-12 h-12 text-orange-400">
              <ChromeIcon />
            </div>
            <h3 className="text-lg font-semibold text-orange-400">Browser Automation</h3>
            <p className="text-sm text-muted-foreground">
              Chrome/Chromium automation with Puppeteer
            </p>
          </div>
          
          <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-[var(--gray-3)]">
            <div className="w-12 h-12 text-cyan-400">
              <SteelIcon />
            </div>
            <h3 className="text-lg font-semibold text-cyan-400">Session Management</h3>
            <p className="text-sm text-muted-foreground">
              Isolated browser contexts and session tracking
            </p>
          </div>
          
          <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-[var(--gray-3)]">
            <div className="w-12 h-12 text-emerald-400">
              <GlobeIcon />
            </div>
            <h3 className="text-lg font-semibold text-emerald-400">Real-time Monitoring</h3>
            <p className="text-sm text-muted-foreground">
              Live browser session debugging and monitoring
            </p>
          </div>
        </div>

        <div className="space-y-4 mt-12">
          <Button 
            onClick={handleCreateSession} 
            size="lg" 
            className="text-lg px-8 py-3"
            disabled={createSessionMutation.isPending}
          >
            {createSessionMutation.isPending ? "Creating..." : "Create New Session"}
          </Button>
          
          {isLoading ? (
            <p className="text-muted-foreground">Loading sessions...</p>
          ) : session && session.length > 0 ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">Active Sessions:</p>
              <div className="flex flex-col items-center gap-3">
                {session.map((s) => (
                  <Button
                    key={s.id}
                    variant="outline"
                    onClick={() => navigate(`/sessions/${s.id}`)}
                    className="text-sm bg-blue-500 hover:bg-blue-600 text-white border-blue-500 hover:border-blue-600"
                  >
                    <span className="truncate">{s.id}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No active sessions</p>
          )}
        </div>
      </div>
    </div>
  );
}