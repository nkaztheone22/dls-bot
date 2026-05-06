import React, { useState } from "react";
import {
  useGetBotStatus, getGetBotStatusQueryKey,
  useGetStats, getGetStatsQueryKey,
  useGetActivity, getGetActivityQueryKey,
  useRequestPairingCode,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Activity, Link as LinkIcon, Shield, Users, Command, Globe, Clock, MessageSquareWarning, Smartphone, QrCode } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type LinkMethod = "qr" | "code";

export default function Dashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [linkMethod, setLinkMethod] = useState<LinkMethod>("qr");
  const [phone, setPhone] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const { data: status } = useGetBotStatus({
    query: {
      queryKey: getGetBotStatusQueryKey(),
      refetchInterval: (data) => (data?.state?.data?.connected ? 10000 : 3000),
    },
  });

  const { data: stats } = useGetStats({
    query: { queryKey: getGetStatsQueryKey(), refetchInterval: 10000 },
  });

  const { data: activity } = useGetActivity({
    query: { queryKey: getGetActivityQueryKey(), refetchInterval: 5000 },
  });

  const pair = useRequestPairingCode({
    mutation: {
      onSuccess: (data) => {
        if (data.success && data.code) {
          setPairingCode(data.code);
          qc.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
        } else {
          toast({ title: "Error", description: data.message, variant: "destructive" });
        }
      },
      onError: () => {
        toast({ title: "Failed to request pairing code", variant: "destructive" });
      },
    },
  });

  const handlePair = () => {
    const clean = phone.replace(/\D/g, "");
    if (!clean) return;
    setPairingCode(null);
    pair.mutate({ data: { phoneNumber: clean } });
  };

  const uptime = status?.uptime;

  return (
    <ScrollArea className="flex-1 h-full p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter">SYSTEM_STATUS</h1>
            <p className="text-muted-foreground mt-1">Real-time bot monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            {status?.connected ? (
              <Badge className="bg-primary/20 text-primary border-primary/50 px-4 py-1 text-sm rounded-none">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2" />
                CONNECTED: {status.phoneNumber}
              </Badge>
            ) : (
              <Badge variant="destructive" className="px-4 py-1 text-sm rounded-none">
                DISCONNECTED
              </Badge>
            )}
            {uptime != null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {Math.floor(uptime / 3600)}h {Math.floor((uptime % 3600) / 60)}m
              </div>
            )}
          </div>
        </div>

        {/* Link Device Panel — shown when disconnected */}
        {!status?.connected && (
          <Card className="border-primary/30 bg-primary/5 rounded-none">
            <CardHeader className="border-b border-primary/20 pb-4">
              <CardTitle className="text-base text-primary flex items-center gap-2">
                LINK_DEVICE
              </CardTitle>
              {/* Method toggle */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setLinkMethod("qr"); setPairingCode(null); }}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border transition-colors rounded-none ${linkMethod === "qr" ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  QR CODE
                </button>
                <button
                  onClick={() => { setLinkMethod("code"); }}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border transition-colors rounded-none ${linkMethod === "code" ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  PHONE NUMBER
                </button>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {linkMethod === "qr" ? (
                /* QR Code */
                status?.qr ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-xl">
                      <img src={status.qr} alt="WhatsApp QR Code" className="w-56 h-56" />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Open WhatsApp → Linked Devices → Link a Device → scan code
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">QR refreshes automatically every 20 seconds</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <QrCode className="h-8 w-8 text-muted-foreground animate-pulse" />
                    <p className="text-sm text-muted-foreground">Generating QR code...</p>
                  </div>
                )
              ) : (
                /* Pairing Code */
                <div className="max-w-sm mx-auto space-y-5">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Enter your WhatsApp number in international format (no + or spaces).
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">Example: 27821234567</p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="27821234567"
                      className="font-mono rounded-none"
                      onKeyDown={(e) => e.key === "Enter" && handlePair()}
                    />
                    <Button
                      onClick={handlePair}
                      disabled={pair.isPending || !phone.trim()}
                      className="rounded-none shrink-0"
                    >
                      {pair.isPending ? "REQUESTING..." : "GET CODE"}
                    </Button>
                  </div>

                  {pairingCode && (
                    <div className="border border-primary/50 bg-primary/10 p-5 text-center space-y-2 rounded-none">
                      <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Your pairing code</p>
                      <p className="text-4xl font-bold font-mono tracking-[0.3em] text-primary">
                        {pairingCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        WhatsApp → Linked Devices → Link with phone number → enter code
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="TOTAL WARNINGS" value={stats?.totalWarnings ?? 0} icon={Shield} />
          <StatCard title="LINKS DELETED" value={stats?.linksDeleted ?? 0} icon={LinkIcon} />
          <StatCard title="WORDS WARNED" value={stats?.wordsWarned ?? 0} icon={MessageSquareWarning} />
          <StatCard title="USERS KICKED" value={stats?.usersKicked ?? 0} icon={Users} />
          <StatCard title="COMMANDS USED" value={stats?.commandsUsed ?? 0} icon={Command} />
          <StatCard title="ACTIVE GROUPS" value={stats?.activeGroups ?? 0} icon={Globe} />
        </div>

        {/* Activity Feed */}
        <Card className="border-border rounded-none">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              ACTIVITY_LOG
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {(!activity || activity.length === 0) && (
                <div className="p-8 text-center text-muted-foreground text-sm">No recent activity</div>
              )}
              {activity?.map((entry) => (
                <div key={entry.id} className="flex items-start gap-4 p-4 hover:bg-secondary/50 transition-colors">
                  <div className="mt-1 shrink-0">
                    {entry.type === "link_deleted" && <LinkIcon className="h-4 w-4 text-orange-500" />}
                    {entry.type === "word_warned" && <MessageSquareWarning className="h-4 w-4 text-yellow-500" />}
                    {entry.type === "user_kicked" && <Users className="h-4 w-4 text-destructive" />}
                    {entry.type === "command_used" && <Command className="h-4 w-4 text-primary" />}
                    {entry.type === "connected" && <Globe className="h-4 w-4 text-green-500" />}
                    {entry.type === "disconnected" && <Globe className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.detail}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                      {entry.groupId && <span className="truncate max-w-[160px]">{entry.groupId}</span>}
                      {entry.groupId && entry.userId && <span>•</span>}
                      {entry.userId && <span className="truncate max-w-[120px]">{entry.userId}</span>}
                      <span>•</span>
                      <span className="whitespace-nowrap">{formatDistanceToNow(entry.timestamp, { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </ScrollArea>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: any }) {
  return (
    <Card className="rounded-none border-border">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground font-mono">{value.toLocaleString()}</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}
