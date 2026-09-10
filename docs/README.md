# GHASI AI – Dokumentations-Übersicht

Kuratierte Einstiegspunkte für Client-Teams und Entwicklung.

## API & Integration (Client-Teams)

| Thema | Dokument | Inhalt |
| --- | --- | --- |
| API-Fehlerformat Daueraufträge | [API-FEHLERFORMAT-DAUERAUFTRAEGE.md](./API-FEHLERFORMAT-DAUERAUFTRAEGE.md) | Strukturierte Feldfehler für `createRecurring` / `updateRecurring`: Marker `__GHASI_FELDFEHLER__`, `fields[].path/label/message`, Pfadnormalisierung, Client-Dekodierung |
| OpenAPI-Spezifikation Daueraufträge | [openapi-dauerauftraege.yaml](./openapi-dauerauftraege.yaml) | Maschinenlesbare Schemata inkl. `x-ghasi-field-error-marker` und Field-Path-Kodierung |
| MCP-Agent-Tools | [MCP-TOOLS.md](./MCP-TOOLS.md) | Alle 8 MCP-Tools: Auth (OAuth + Scopes + Rollen), Parameter, Request-/Response-Beispiele |

## Produkt & Architektur

| Thema | Dokument |
| --- | --- |
| Verhaltensregeln (Constitution) | [GHASI-CONSTITUTION.md](./GHASI-CONSTITUTION.md) |
| Architektur | [GHASI-ARCHITECTURE.md](./GHASI-ARCHITECTURE.md) |
| Domänenmodell | [GHASI-DOMAIN-MODEL.md](./GHASI-DOMAIN-MODEL.md) |
| Blueprint | [GHASI-AI-BLUEPRINT.md](./GHASI-AI-BLUEPRINT.md) |
| Agent-Guardrails | [GHASI-AGENT-GUARDRAILS.md](./GHASI-AGENT-GUARDRAILS.md) |
| Design-System | [GHASI-DESIGN-SYSTEM.md](./GHASI-DESIGN-SYSTEM.md) |
| Umsetzungsleitfaden | [GHASI-IMPLEMENTATION-GUIDE.md](./GHASI-IMPLEMENTATION-GUIDE.md) |
| Roadmap | [GHASI-ROADMAP.md](./GHASI-ROADMAP.md) |

## Änderungshistorie

Siehe [CHANGELOG.md](./CHANGELOG.md).
