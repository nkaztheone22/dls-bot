import React from "react";
import {
  useGetWarnings,
  getGetWarningsQueryKey,
  useDeleteWarning,
  useClearAllWarnings,
  useGetSettings,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, Trash2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Warnings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: warnings, isLoading } = useGetWarnings({
    query: { queryKey: getGetWarningsQueryKey(), refetchInterval: 10000 },
  });

  const { data: settings } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });

  const deleteWarning = useDeleteWarning({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetWarningsQueryKey() });
        toast({ title: "Warning cleared" });
      },
    },
  });

  const clearAll = useClearAllWarnings({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetWarningsQueryKey() });
        toast({ title: "All warnings cleared" });
      },
    },
  });

  const warnKick = settings?.warnKick ?? 3;

  const sorted = [...(warnings ?? [])].sort((a, b) => b.count - a.count);

  function shortId(id: string) {
    return id.split("@")[0] ?? id;
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm font-mono animate-pulse">LOADING WARNINGS...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-full p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter">WARNINGS</h1>
            <p className="text-muted-foreground mt-1">
              {sorted.length} active warning{sorted.length !== 1 ? "s" : ""}
            </p>
          </div>
          {sorted.length > 0 && (
            <Button
              variant="destructive"
              className="rounded-none gap-2"
              onClick={() => clearAll.mutate(undefined)}
              disabled={clearAll.isPending}
            >
              <Trash2 className="h-4 w-4" />
              CLEAR ALL
            </Button>
          )}
        </div>

        <Card className="rounded-none border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              ACTIVE_WARNINGS
              <Badge variant="secondary" className="ml-auto rounded-none font-mono text-xs">
                limit: {warnKick}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {sorted.length === 0 ? (
              <div className="p-12 text-center">
                <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No active warnings</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sorted.map((entry) => {
                  const pct = Math.min((entry.count / warnKick) * 100, 100);
                  const isNearKick = entry.count >= warnKick - 1;
                  return (
                    <div key={entry.key} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold">
                            {shortId(entry.userId)}
                          </span>
                          <Badge
                            variant={isNearKick ? "destructive" : "secondary"}
                            className="rounded-none font-mono text-xs"
                          >
                            {entry.count}/{warnKick}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress
                            value={pct}
                            className="h-1.5 flex-1 rounded-none"
                          />
                          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {formatDistanceToNow(entry.lastWarn, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {shortId(entry.groupId)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          deleteWarning.mutate({
                            warningKey: encodeURIComponent(entry.key),
                          })
                        }
                        disabled={deleteWarning.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
