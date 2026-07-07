import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/prognosen")({
  beforeLoad: () => {
    throw redirect({ to: "/ceo-cockpit", search: { tab: "prognosen" } });
  },
});
