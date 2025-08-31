import { useState, useEffect } from 'react';
import { BCIStatus } from '../components/BCIStatus';
import { ConfusionGraph } from '../components/ConfusionGraph';
import { ChatBot } from '../components/ChatBot';
import { Brain, Zap, Activity } from 'lucide-react';

const Index = () => {
  const [confusionLevel, setConfusionLevel] = useState(20);
  const [isConnected, setIsConnected] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const fetchConfusion = async () => {
      try {
        const res = await fetch("http://localhost:8000/confusion");
        const data = await res.json();
        console.log("Fetched confusion level:", data.confusionLevel); // 👈 Add this
        const level = Number(data.confusionLevel);
        setConfusionLevel(isNaN(level) ? 0 : level);
      } catch (err) {
        console.error("Failed to fetch confusion level:", err);
        setConfusionLevel(0);
      }
    };

    const interval = setInterval(fetchConfusion, 2000);
    fetchConfusion(); // initial call
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Neural background pattern */}
      <div className="absolute inset-0 bg-neural-gradient opacity-5" />
      
      {/* Header */}
      <header className="relative z-10 p-6 glass-card border-b border-border/50">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 neural-pulse">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-neural-gradient bg-clip-text text-transparent">
                NeuroLearn Assistant
              </h1>
              <p className="text-muted-foreground text-sm">BCI-Powered Learning Support</p>
            </div>
          </div>
          
          <BCIStatus isConnected={isConnected} />
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="relative z-10 p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <ChatBot inline />
          </div>
          <div className="lg:col-span-1">
            <ConfusionGraph confusionLevel={confusionLevel} />
          </div>
        </div>

        {/* Bottom Panel - Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <Activity className="w-5 h-5 text-accent" />
              <h3 className="font-semibold">Session Stats</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Problems Solved</span>
                <span className="font-mono">7</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg. Confusion</span>
                <span className="font-mono">{Math.round(confusionLevel)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Help Requests</span>
                <span className="font-mono">3</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="w-5 h-5 text-warning" />
              <h3 className="font-semibold">Neural Activity</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alpha Waves</span>
                <span className="font-mono text-success">Normal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Beta Waves</span>
                <span className="font-mono text-warning">Elevated</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Theta Waves</span>
                <span className="font-mono text-success">Stable</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <Brain className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Learning State</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Focus Level</span>
                <span className="font-mono text-success">High</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stress Level</span>
                <span className="font-mono text-accent">Moderate</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Engagement</span>
                <span className="font-mono text-success">Optimal</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Help Overlay */}
    </div>
  );
};

export default Index;