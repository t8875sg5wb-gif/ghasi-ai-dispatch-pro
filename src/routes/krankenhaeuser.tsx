import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/krankenhaeuser")({
  beforeLoad: () => {
    throw redirect({ to: "/einrichtungen", search: { tab: "krankenhaeuser" } });
  },
});
