import { createFileRoute } from "@tanstack/react-router";
import { FolderArchive } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/dokumente")({
  head: () => ({
    meta: [
      { title: "Dokumente – GHASI AI" },
      { name: "description", content: "Zentrales Dokumentenarchiv und Vorlagen verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Dokumente"
      description="Zentrales Dokumentenarchiv und Vorlagen verwalten."
      icon={FolderArchive}
      features={[
    "Dokumentenarchiv",
    "Vorlagen",
    "Versionierung",
    "Freigaben",
    "Suche",
    "Fristen",
      ]}
    />
  ),
});
