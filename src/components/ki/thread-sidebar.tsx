import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useThreads, useThreadMutations } from "@/hooks/use-threads";
import { cn } from "@/lib/utils";

export function ThreadSidebar({
  activeId,
  onNavigate,
}: {
  activeId?: string;
  onNavigate?: () => void;
}) {
  const { data: threads, isLoading } = useThreads();
  const { create, remove } = useThreadMutations();
  const navigate = useNavigate();
  const [toDelete, setToDelete] = useState<string | null>(null);

  const newThread = async () => {
    const t = await create.mutateAsync(undefined);
    navigate({ to: "/ki-assistent/$threadId", params: { threadId: t.id } });
    onNavigate?.();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const wasActive = toDelete === activeId;
    await remove.mutateAsync(toDelete);
    setToDelete(null);
    if (wasActive) navigate({ to: "/ki-assistent" });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button onClick={newThread} disabled={create.isPending} className="w-full rounded-xl">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Neue Unterhaltung
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {isLoading && <p className="px-2 py-4 text-xs text-muted-foreground">Lade Verlauf …</p>}
        {!isLoading && (threads?.length ?? 0) === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            Noch keine Unterhaltungen. Starten Sie eine neue.
          </p>
        )}
        {threads?.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group relative flex items-center rounded-xl transition-colors",
              t.id === activeId ? "bg-primary/10" : "hover:bg-muted/60",
            )}
          >
            <Link
              to="/ki-assistent/$threadId"
              params={{ threadId: t.id }}
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5"
            >
              <MessageSquare
                className={cn(
                  "h-4 w-4 shrink-0",
                  t.id === activeId ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  t.id === activeId ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {t.titel}
              </span>
            </Link>
            <button
              onClick={() => setToDelete(t.id)}
              className="mr-1.5 shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              aria-label="Unterhaltung löschen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unterhaltung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Unterhaltung und alle Nachrichten werden dauerhaft entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
