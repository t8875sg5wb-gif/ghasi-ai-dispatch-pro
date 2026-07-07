import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/statistiken")({
  beforeLoad: () => {
    throw redirect({ to: "/ceo-cockpit", search: { tab: "statistiken" } });
  },
});
