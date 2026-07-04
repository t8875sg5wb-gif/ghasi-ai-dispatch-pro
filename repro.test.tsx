import { describe, it, vi, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const sampleOrders = [
  { id: "o1", nummer: "A-1", patient: "Max", transportart: "Sitzendtransport",
    prioritaet: "normal", status: "neu", pickup: {}, destination: {},
    abholort: "Bahnhofstr 1, Minden", zielort: "Klinikum Minden", termin: "2026-07-04T09:00:00",
    fahrer: null, fahrzeug: null, kostentraeger: "", notiz: "", verordnung: "nicht_erhalten",
    verordnungDokumentId: null, mobilitaet: undefined, begleitperson: false,
    abholanforderung: "", zielanforderung: "", patientennotiz: "", medizinischeNotiz: "",
    detailStatus: null, abrechnungStatus: "offen", dauerauftragId: null },
];
vi.mock("@/lib/orders-store", () => ({
  useOrders: () => ({ data: sampleOrders, isLoading: false, isError: false }),
  useUpdateOrder: () => ({ mutate: () => {} }),
}));
vi.mock("@/lib/protokoll", () => ({ logActivity: () => {} }));
vi.mock("@/components/gps/live-fleet-map-card", () => ({ LiveFleetMapCard: () => null }));

describe("DispatchCenter", () => {
  it("renders without crashing", async () => {
    const { Route } = await import("@/routes/tourenplanung");
    const Comp = (Route.options as any).component;
    const qc = new QueryClient();
    const { container } = render(
      React.createElement(QueryClientProvider, { client: qc }, React.createElement(Comp))
    );
    expect(container).toBeTruthy();
  });
});
