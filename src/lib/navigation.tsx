import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Truck,
  Building2,
  HeartPulse,
  Hospital,
  Droplets,
  Home,
  Route as RouteIcon,
  MapPin,
  Phone,
  Bot,
  Activity,
  Calculator,
  FileText,
  Wrench,
  ShieldCheck,
  CarFront,
  BarChart3,
  PieChart,
  FolderArchive,
  Settings,
  ShieldUser,
  Plug,
  Gauge,
  Lightbulb,
  ShieldAlert,
  LineChart,
  Inbox,
  Sparkles,
  Workflow,
  Repeat,
  Compass,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  description: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Übersicht",
    items: [
      {
        label: "Dashboard",
        to: "/",
        icon: LayoutDashboard,
        description: "Zentrale Echtzeit-Übersicht über Ihr gesamtes Unternehmen.",
      },
      {
        label: "CEO Cockpit",
        to: "/ceo-cockpit",
        icon: Crown,
        description:
          "Der digitale Geschäftsführer: Prognosen, Cashflow, Kapazität, Empfehlungen & Risiken mit finanzieller Wirkung.",
      },
      {
        label: "Control Center",
        to: "/control-center",
        icon: Gauge,
        description:
          "Executive-Kommandozentrale: Live-KPIs, Business Health Score & KI-Lageanalyse.",
      },
      {
        label: "KI-Insights",
        to: "/insights",
        icon: Lightbulb,
        description: "Autonome Optimierungschancen mit Begründung – Kosten, Gewinn, Auslastung.",
      },
      {
        label: "Alert-Center",
        to: "/warnungen",
        icon: ShieldAlert,
        description: "Smart Alert Center: alle Warnungen nach Priorität in Echtzeit.",
      },
      {
        label: "Prognosen",
        to: "/prognosen",
        icon: LineChart,
        description: "Predictive AI: Umsatz-, Auslastungs-, Personal- und Wartungsprognosen.",
      },
      {
        label: "KI-Assistent",
        to: "/ki-assistent",
        icon: Bot,
        description: "GHASI AI – Ihr digitaler Geschäftsführer im Dialog.",
      },
      {
        label: "Aktivitäten",
        to: "/aktivitaeten",
        icon: Activity,
        description: "Lückenloses Protokoll: wer hat wann was geändert.",
      },
    ],
  },
  {
    label: "Kommunikation",
    items: [
      {
        label: "Posteingang",
        to: "/posteingang",
        icon: Inbox,
        description:
          "Vereinheitlichter Posteingang für alle Module – verknüpft mit dem Ursprungsobjekt.",
      },
      {
        label: "Aktions-Center",
        to: "/aktions-center",
        icon: Sparkles,
        description:
          "KI-Nachrichten-Entwürfe warten auf Ihre Freigabe – kein automatischer Versand.",
      },
    ],
  },
  {
    label: "Betrieb",
    items: [
      {
        label: "Aufträge",
        to: "/auftraege",
        icon: ClipboardList,
        description: "Alle Krankentransporte erfassen, disponieren und verfolgen.",
      },
      {
        label: "Daueraufträge",
        to: "/dauerauftraege",
        icon: Repeat,
        description:
          "Wiederkehrende Serien (Dialyse, Pflege, Klinik) automatisch in Transporte umwandeln.",
      },
      {
        label: "Dispatch-Center",
        to: "/tourenplanung",
        icon: RouteIcon,
        description: "Intelligente Disposition: Plantafel, Drag & Drop und KI-Zuteilung.",
      },
      {
        label: "Live-GPS",
        to: "/live-gps",
        icon: MapPin,
        description: "Standort aller Fahrzeuge in Echtzeit auf der Karte.",
      },
      {
        label: "Standorte & Umgebung",
        to: "/standorte",
        icon: Compass,
        description:
          "Kliniken, Ärzte, Apotheken, Tank- & Ladesäulen finden – powered by Google Maps.",
      },
      {
        label: "Telefon",
        to: "/telefon",
        icon: Phone,
        description: "Integrierte Telefonie, Anrufannahme und Protokolle.",
      },
    ],
  },
  {
    label: "Stammdaten",
    items: [
      {
        label: "Fahrer",
        to: "/fahrer",
        icon: Users,
        description: "Personal, Qualifikationen, Verfügbarkeiten und Schichten.",
      },
      {
        label: "Fahrzeuge",
        to: "/fahrzeuge",
        icon: Truck,
        description: "Flotte, Ausstattung, Status und Dokumente.",
      },
      {
        label: "Kunden",
        to: "/kunden",
        icon: Building2,
        description: "Auftraggeber, Kassen und Vertragspartner.",
      },
      {
        label: "Patienten",
        to: "/patienten",
        icon: HeartPulse,
        description: "Patientenakten, Mobilität und Transportbedarf.",
      },
      {
        label: "Krankenhäuser",
        to: "/krankenhaeuser",
        icon: Hospital,
        description: "Kliniken, Stationen und Ansprechpartner.",
      },
      {
        label: "Dialysezentren",
        to: "/dialysezentren",
        icon: Droplets,
        description: "Dialysepartner, Termine und wiederkehrende Fahrten.",
      },
      {
        label: "Pflegeheime",
        to: "/pflegeheime",
        icon: Home,
        description: "Einrichtungen, Bewohner und regelmäßige Transporte.",
      },
    ],
  },
  {
    label: "Finanzen",
    items: [
      {
        label: "Buchhaltung",
        to: "/buchhaltung",
        icon: Calculator,
        description: "Einnahmen, Ausgaben und betriebswirtschaftliche Auswertung.",
      },
      {
        label: "Rechnungen",
        to: "/rechnungen",
        icon: FileText,
        description: "Abrechnung, Mahnwesen und offene Posten.",
      },
      {
        label: "Versicherungen",
        to: "/versicherungen",
        icon: ShieldCheck,
        description: "Policen, Fristen und Schadensfälle der Flotte.",
      },
      {
        label: "Leasing",
        to: "/leasing",
        icon: CarFront,
        description: "Leasingverträge, Raten und Laufzeiten.",
      },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      {
        label: "Wartung",
        to: "/wartung",
        icon: Wrench,
        description: "Inspektionen, TÜV, Reparaturen und Servicehistorie.",
      },
      {
        label: "Berichte",
        to: "/berichte",
        icon: BarChart3,
        description: "Operative und finanzielle Reports auf Knopfdruck.",
      },
      {
        label: "Statistiken",
        to: "/statistiken",
        icon: PieChart,
        description: "Kennzahlen, Trends und Analysen im Zeitverlauf.",
      },
      {
        label: "Dokumente",
        to: "/dokumente",
        icon: FolderArchive,
        description: "Zentrales Dokumentenarchiv und Vorlagen.",
      },
      {
        label: "Automatisierung",
        to: "/automatisierung",
        icon: Workflow,
        description: "Wiederkehrende Aufgaben & Abrechnungen – nur mit Freigabe.",
      },
      {
        label: "Verbindungen",
        to: "/verbindungen",
        icon: Plug,
        description: "WhatsApp, E-Mail, Kalender, Maps & Web-Zugriff für GHASI AI.",
      },
      {
        label: "Einstellungen",
        to: "/einstellungen",
        icon: Settings,
        description: "Unternehmensdaten, Benachrichtigungen und Präferenzen.",
      },
      {
        label: "Administration",
        to: "/administration",
        icon: ShieldUser,
        description: "Benutzer, Rollen, Rechte und Systemkonfiguration.",
      },
    ],
  },
];

export const allNavItems: NavItem[] = navGroups.flatMap((group) => group.items);
