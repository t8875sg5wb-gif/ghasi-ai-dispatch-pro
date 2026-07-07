import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/berichte")({
  beforeLoad: () => {
    throw redirect({ to: "/ceo-cockpit", search: { tab: "berichte" } });
  },
});
