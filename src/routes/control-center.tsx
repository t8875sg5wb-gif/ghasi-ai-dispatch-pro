import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/control-center")({
  beforeLoad: () => {
    throw redirect({ to: "/ceo-cockpit", search: { tab: "control-center" } });
  },
});
