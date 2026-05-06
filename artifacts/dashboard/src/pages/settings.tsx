import React, { useState } from "react";
import {
  useGetSettings,
  getGetSettingsQueryKey,
  useUpdateSettings,
  useAddBadword,
  useRemoveBadword,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, Plus, Settings2, ShieldBan, Link, MessageSquareWarning, Smile } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });

  const update = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved" });
      },
    },
  });

  const addWord = useAddBadword({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        setNewWord("");
      },
    },
  });

  const removeWord = useRemoveBadword({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() }),
    },
  });

  const [newWord, setNewWord] = useState("");
  const [warnKickInput, setWarnKickInput] = useState<string>("");

  React.useEffect(() => {
    if (settings?.warnKick !== undefined) {
      setWarnKickInput(String(settings.warnKick));
    }
  }, [settings?.warnKick]);

  const handleToggle = (key: "antilink" | "antiword" | "welcome", value: boolean) => {
    update.mutate({ data: { [key]: value } });
  };

  const handleWarnKickSave = () => {
    const n = parseInt(warnKickInput);
    if (n > 0) update.mutate({ data: { warnKick: n } });
  };

  const handleAddWord = () => {
    const word = newWord.trim().toLowerCase();
    if (word) addWord.mutate({ data: { word } });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm font-mono animate-pulse">LOADING CONFIG...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-full p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">CONFIGURATION</h1>
          <p className="text-muted-foreground mt-1">Manage bot protection settings</p>
        </div>

        {/* Protection Toggles */}
        <Card className="rounded-none border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              PROTECTION_MODULES
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            <ToggleRow
              icon={<Link className="h-4 w-4" />}
              label="ANTI_LINK"
              description="Delete messages containing URLs or invite links"
              checked={settings?.antilink ?? false}
              onCheckedChange={(v) => handleToggle("antilink", v)}
            />
            <ToggleRow
              icon={<ShieldBan className="h-4 w-4" />}
              label="ANTI_WORD"
              description="Warn and kick users who use banned words"
              checked={settings?.antiword ?? false}
              onCheckedChange={(v) => handleToggle("antiword", v)}
            />
            <ToggleRow
              icon={<Smile className="h-4 w-4" />}
              label="WELCOME_MSG"
              description="Send a welcome message when new members join"
              checked={settings?.welcome ?? false}
              onCheckedChange={(v) => handleToggle("welcome", v)}
            />
          </CardContent>
        </Card>

        {/* Warn Kick Limit */}
        <Card className="rounded-none border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-primary" />
              WARN_KICK_LIMIT
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Number of warnings before a user is automatically removed from the group.
            </p>
            <div className="flex gap-3 items-center">
              <Input
                type="number"
                min={1}
                max={20}
                value={warnKickInput}
                onChange={(e) => setWarnKickInput(e.target.value)}
                className="w-32 font-mono rounded-none"
              />
              <Button
                onClick={handleWarnKickSave}
                disabled={update.isPending}
                className="rounded-none"
              >
                SAVE
              </Button>
              <span className="text-sm text-muted-foreground font-mono">
                current: {settings?.warnKick}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Banned Words */}
        <Card className="rounded-none border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldBan className="h-4 w-4 text-primary" />
              BANNED_WORDS
              <Badge variant="secondary" className="ml-auto rounded-none font-mono text-xs">
                {settings?.badwords?.length ?? 0} entries
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Add word */}
            <div className="flex gap-3">
              <Input
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="add new word..."
                className="font-mono rounded-none"
                onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
              />
              <Button
                onClick={handleAddWord}
                disabled={addWord.isPending || !newWord.trim()}
                className="rounded-none gap-2"
              >
                <Plus className="h-4 w-4" />
                ADD
              </Button>
            </div>

            <Separator />

            {/* Word list */}
            <div className="flex flex-wrap gap-2">
              {settings?.badwords?.length === 0 && (
                <p className="text-sm text-muted-foreground">No banned words configured.</p>
              )}
              {settings?.badwords?.map((word) => (
                <Badge
                  key={word}
                  variant="secondary"
                  className="rounded-none font-mono text-xs px-3 py-1 gap-2 group"
                >
                  {word}
                  <button
                    onClick={() => removeWord.mutate({ data: { word } })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-5 gap-4">
      <div className="flex items-start gap-3">
        <span className="text-primary mt-0.5">{icon}</span>
        <div>
          <Label className="text-sm font-bold font-mono tracking-wide">{label}</Label>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
