import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pflegeheime")({
  beforeLoad: () => {
    throw redirect({ to: "/einrichtungen", search: { tab: "pflegeheime" } });
  },
});
