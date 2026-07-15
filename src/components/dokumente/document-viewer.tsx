// Inline viewer for persisted documents (image + PDF preview) using a
// short-lived signed URL from the private storage bucket.
import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { signedDocumentUrlById } from "@/lib/documents-store";
import type { DokumentRecord } from "@/lib/documents-shared";

export function DocumentViewer({
  dokument,
  open,
  onOpenChange,
}: {
  dokument: DokumentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    let aktiv = true;
    if (!open || !dokument) {
      setUrl(null);
      setFehler(false);
      return;
    }
    setLoading(true);
    setFehler(false);
    signedDocumentUrlById(dokument.id)
      .then((u: string | null) => {
        if (!aktiv) return;
        if (u) setUrl(u);
        else setFehler(true);
      })
      .finally(() => aktiv && setLoading(false));
    return () => {
      aktiv = false;
    };
  }, [open, dokument]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{dokument?.name ?? "Dokument"}</DialogTitle>
        </DialogHeader>

        <div className="min-h-[50vh]">
          {loading && (
            <div className="flex h-[50vh] items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {!loading && fehler && (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Vorschau konnte nicht geladen werden.</p>
            </div>
          )}
          {!loading && url && dokument && (
            <>
              {dokument.format === "bild" ? (
                <img
                  src={url}
                  alt={dokument.name}
                  className="mx-auto max-h-[65vh] w-auto rounded-lg object-contain"
                />
              ) : dokument.format === "pdf" ? (
                <iframe
                  title={dokument.name}
                  src={url}
                  className="h-[65vh] w-full rounded-lg border border-border/60"
                />
              ) : (
                <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
                  <FileText className="h-8 w-8" />
                  <p className="text-sm">Für dieses Format ist keine Inline-Vorschau verfügbar.</p>
                </div>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> In neuem Tab
                  </a>
                </Button>
                <Button asChild size="sm" className="rounded-full">
                  <a href={url} download={dokument.name}>
                    <Download className="h-4 w-4" /> Herunterladen
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
