// GHASI AI MCP-Server. Nur die Handler laufen in Requests; auf Modulebene
// werden keine Env-Variablen gelesen und kein I/O ausgelöst.
import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOrders from "./tools/list-orders";
import getOrder from "./tools/get-order";
import listDrivers from "./tools/list-drivers";
import listVehicles from "./tools/list-vehicles";
import listInvoices from "./tools/list-invoices";

// Direkter Supabase-Auth-Issuer (nicht die .lovable.cloud-Proxy-URL).
// VITE_SUPABASE_PROJECT_ID wird von Vite als Literal eingebettet.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ghasi-ai-mcp",
  title: "GHASI AI",
  version: "0.1.0",
  instructions:
    "Tools für GHASI AI (digitaler Geschäftsführer für Krankentransportunternehmen). Alle Tools sind lesend und gelten für die Firma des angemeldeten Benutzers (RLS).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOrders, getOrder, listDrivers, listVehicles, listInvoices],
});
