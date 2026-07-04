import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dialysezentren")({
  beforeLoad: () => {
    throw redirect({ to: "/einrichtungen", search: { tab: "dialysezentren" } });
  },
});
