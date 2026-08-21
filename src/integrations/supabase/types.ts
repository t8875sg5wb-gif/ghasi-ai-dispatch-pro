export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          akteur: string
          aktion: string
          bereich: string
          beschreibung: string
          created_at: string
          entitaet: string | null
          id: string
          metadaten: Json | null
          user_id: string | null
        }
        Insert: {
          akteur?: string
          aktion: string
          bereich: string
          beschreibung: string
          created_at?: string
          entitaet?: string | null
          id?: string
          metadaten?: Json | null
          user_id?: string | null
        }
        Update: {
          akteur?: string
          aktion?: string
          bereich?: string
          beschreibung?: string
          created_at?: string
          entitaet?: string | null
          id?: string
          metadaten?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_audit_log: {
        Row: {
          created_at: string
          dauer_ms: number | null
          erfolg: boolean
          id: string
          modell: string | null
          quellen: Json | null
          rolle: string | null
          thread_id: string | null
          user_id: string | null
          vorbereitete_aktionen: Json | null
          werkzeuge: string[] | null
        }
        Insert: {
          created_at?: string
          dauer_ms?: number | null
          erfolg?: boolean
          id?: string
          modell?: string | null
          quellen?: Json | null
          rolle?: string | null
          thread_id?: string | null
          user_id?: string | null
          vorbereitete_aktionen?: Json | null
          werkzeuge?: string[] | null
        }
        Update: {
          created_at?: string
          dauer_ms?: number | null
          erfolg?: boolean
          id?: string
          modell?: string | null
          quellen?: Json | null
          rolle?: string | null
          thread_id?: string | null
          user_id?: string | null
          vorbereitete_aktionen?: Json | null
          werkzeuge?: string[] | null
        }
        Relationships: []
      }
      automation_states: {
        Row: {
          automation_id: string
          created_at: string
          status: string
          updated_at: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          auftrag_erstellt: boolean
          created_at: string
          dauer_sek: number
          id: string
          kategorie: string
          name: string | null
          notiz: string | null
          nummer: string
          richtung: string
          status: string
          updated_at: string
          zeitpunkt: string
        }
        Insert: {
          auftrag_erstellt?: boolean
          created_at?: string
          dauer_sek?: number
          id?: string
          kategorie?: string
          name?: string | null
          notiz?: string | null
          nummer?: string
          richtung?: string
          status?: string
          updated_at?: string
          zeitpunkt?: string
        }
        Update: {
          auftrag_erstellt?: boolean
          created_at?: string
          dauer_sek?: number
          id?: string
          kategorie?: string
          name?: string | null
          notiz?: string | null
          nummer?: string
          richtung?: string
          status?: string
          updated_at?: string
          zeitpunkt?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          inhalt: string
          parts: Json | null
          quellen: Json | null
          rolle: string
          thread_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          inhalt?: string
          parts?: Json | null
          quellen?: Json | null
          rolle: string
          thread_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          inhalt?: string
          parts?: Json | null
          quellen?: Json | null
          rolle?: string
          thread_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          archiviert: boolean
          created_at: string
          id: string
          titel: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          archiviert?: boolean
          created_at?: string
          id?: string
          titel?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          archiviert?: boolean
          created_at?: string
          id?: string
          titel?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      communication_drafts: {
        Row: {
          betreff: string | null
          bezug: Json | null
          created_at: string
          empfaenger: string
          erklaerung: string
          grund: string
          id: string
          kanal: string
          kategorie: string
          nachricht: string
          prioritaet: string
          quelldaten: Json
          status: string
          titel: string
          updated_at: string
        }
        Insert: {
          betreff?: string | null
          bezug?: Json | null
          created_at?: string
          empfaenger?: string
          erklaerung?: string
          grund?: string
          id: string
          kanal?: string
          kategorie?: string
          nachricht?: string
          prioritaet?: string
          quelldaten?: Json
          status?: string
          titel?: string
          updated_at?: string
        }
        Update: {
          betreff?: string | null
          bezug?: Json | null
          created_at?: string
          empfaenger?: string
          erklaerung?: string
          grund?: string
          id?: string
          kanal?: string
          kategorie?: string
          nachricht?: string
          prioritaet?: string
          quelldaten?: Json
          status?: string
          titel?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          adresse: string
          adresse_hausnummer: string
          adresse_land: string
          adresse_ort: string
          adresse_plz: string
          adresse_strasse: string
          betriebskosten_arbeitstage: number
          betriebskosten_dieselpreis: number
          chat_retention_months: number
          created_at: string
          datev_berater_nr: string
          datev_erloeskonto: string
          datev_gegenkonto: string
          datev_mandant_nr: string
          email: string
          firma: string
          gewerbesteuer_hebesatz: number
          iban: string
          id: string
          ik_nummer: string | null
          inhaber: string
          rechtsform: string
          singleton: number
          steuer_modus: string
          steuer_modus_bestaetigt: boolean
          steuernummer: string
          telefon: string
          updated_at: string
          ust_id: string
          xrechnung_daten_bestaetigt: boolean
        }
        Insert: {
          adresse?: string
          adresse_hausnummer?: string
          adresse_land?: string
          adresse_ort?: string
          adresse_plz?: string
          adresse_strasse?: string
          betriebskosten_arbeitstage?: number
          betriebskosten_dieselpreis?: number
          chat_retention_months?: number
          created_at?: string
          datev_berater_nr?: string
          datev_erloeskonto?: string
          datev_gegenkonto?: string
          datev_mandant_nr?: string
          email?: string
          firma?: string
          gewerbesteuer_hebesatz?: number
          iban?: string
          id?: string
          ik_nummer?: string | null
          inhaber?: string
          rechtsform?: string
          singleton?: number
          steuer_modus?: string
          steuer_modus_bestaetigt?: boolean
          steuernummer?: string
          telefon?: string
          updated_at?: string
          ust_id?: string
          xrechnung_daten_bestaetigt?: boolean
        }
        Update: {
          adresse?: string
          adresse_hausnummer?: string
          adresse_land?: string
          adresse_ort?: string
          adresse_plz?: string
          adresse_strasse?: string
          betriebskosten_arbeitstage?: number
          betriebskosten_dieselpreis?: number
          chat_retention_months?: number
          created_at?: string
          datev_berater_nr?: string
          datev_erloeskonto?: string
          datev_gegenkonto?: string
          datev_mandant_nr?: string
          email?: string
          firma?: string
          gewerbesteuer_hebesatz?: number
          iban?: string
          id?: string
          ik_nummer?: string | null
          inhaber?: string
          rechtsform?: string
          singleton?: number
          steuer_modus?: string
          steuer_modus_bestaetigt?: boolean
          steuernummer?: string
          telefon?: string
          updated_at?: string
          ust_id?: string
          xrechnung_daten_bestaetigt?: boolean
        }
        Relationships: []
      }
      conversations: {
        Row: {
          betreff: string
          bezug: Json | null
          created_at: string
          gelesen: boolean
          id: string
          kanal: string
          kategorie: string
          nachrichten: Json
          partner: string
          prioritaet: string
          updated_at: string
        }
        Insert: {
          betreff?: string
          bezug?: Json | null
          created_at?: string
          gelesen?: boolean
          id?: string
          kanal?: string
          kategorie?: string
          nachrichten?: Json
          partner?: string
          prioritaet?: string
          updated_at?: string
        }
        Update: {
          betreff?: string
          bezug?: Json | null
          created_at?: string
          gelesen?: boolean
          id?: string
          kanal?: string
          kategorie?: string
          nachrichten?: Json
          partner?: string
          prioritaet?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          adresse: string | null
          adresse_hausnummer: string
          adresse_land: string
          adresse_ort: string
          adresse_plz: string
          adresse_strasse: string
          aktiv: boolean
          ansprechpartner: string
          created_at: string
          email: string | null
          id: string
          konditionen: string | null
          kreditlimit: number | null
          leitweg_id: string
          name: string
          notiz: string | null
          offene_rechnungen: number
          telefon: string
          typ: string
          umsatz_jahr: number | null
          updated_at: string
          vertragsstatus: string | null
          zahlungsziel_tage: number | null
        }
        Insert: {
          adresse?: string | null
          adresse_hausnummer?: string
          adresse_land?: string
          adresse_ort?: string
          adresse_plz?: string
          adresse_strasse?: string
          aktiv?: boolean
          ansprechpartner?: string
          created_at?: string
          email?: string | null
          id?: string
          konditionen?: string | null
          kreditlimit?: number | null
          leitweg_id?: string
          name: string
          notiz?: string | null
          offene_rechnungen?: number
          telefon?: string
          typ?: string
          umsatz_jahr?: number | null
          updated_at?: string
          vertragsstatus?: string | null
          zahlungsziel_tage?: number | null
        }
        Update: {
          adresse?: string | null
          adresse_hausnummer?: string
          adresse_land?: string
          adresse_ort?: string
          adresse_plz?: string
          adresse_strasse?: string
          aktiv?: boolean
          ansprechpartner?: string
          created_at?: string
          email?: string | null
          id?: string
          konditionen?: string | null
          kreditlimit?: number | null
          leitweg_id?: string
          name?: string
          notiz?: string | null
          offene_rechnungen?: number
          telefon?: string
          typ?: string
          umsatz_jahr?: number | null
          updated_at?: string
          vertragsstatus?: string | null
          zahlungsziel_tage?: number | null
        }
        Relationships: []
      }
      document_cleanup_jobs: {
        Row: {
          created_at: string
          fehler_code: string | null
          grund: string
          id: string
          letzter_versuch_am: string | null
          storage_path: string
          versuche: number
        }
        Insert: {
          created_at?: string
          fehler_code?: string | null
          grund: string
          id?: string
          letzter_versuch_am?: string | null
          storage_path: string
          versuche?: number
        }
        Update: {
          created_at?: string
          fehler_code?: string | null
          grund?: string
          id?: string
          letzter_versuch_am?: string | null
          storage_path?: string
          versuche?: number
        }
        Relationships: []
      }
      documents: {
        Row: {
          bezug: Json | null
          created_at: string
          delete_attempted_at: string | null
          delete_error: string | null
          format: string
          groesse_kb: number
          hochgeladen_von: string
          id: string
          kategorie: string
          name: string
          ocr_text: string | null
          ordner: string
          status: string
          storage_path: string
          tags: Json
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bezug?: Json | null
          created_at?: string
          delete_attempted_at?: string | null
          delete_error?: string | null
          format?: string
          groesse_kb?: number
          hochgeladen_von?: string
          id?: string
          kategorie?: string
          name?: string
          ocr_text?: string | null
          ordner?: string
          status?: string
          storage_path: string
          tags?: Json
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bezug?: Json | null
          created_at?: string
          delete_attempted_at?: string | null
          delete_error?: string | null
          format?: string
          groesse_kb?: number
          hochgeladen_von?: string
          id?: string
          kategorie?: string
          name?: string
          ocr_text?: string | null
          ordner?: string
          status?: string
          storage_path?: string
          tags?: Json
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      driver_shifts: {
        Row: {
          bis: string
          created_at: string
          datum: string
          driver_id: string
          id: string
          notiz: string
          typ: string
          updated_at: string
          von: string
        }
        Insert: {
          bis?: string
          created_at?: string
          datum: string
          driver_id: string
          id?: string
          notiz?: string
          typ?: string
          updated_at?: string
          von?: string
        }
        Update: {
          bis?: string
          created_at?: string
          datum?: string
          driver_id?: string
          id?: string
          notiz?: string
          typ?: string
          updated_at?: string
          von?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          adresse: string
          arbeitszeiten: string
          beschaeftigungsart: string
          beschwerden: number
          bewertung: number
          created_at: string
          email: string
          erste_hilfe: Json
          fahrzeug: string | null
          foto: string | null
          fuehrerschein: Json
          fuehrungszeugnis_datum: string | null
          gewinn_heute: number
          gps: Json
          id: string
          km_heute: number
          krankheitstage: number
          lob: number
          monatsbrutto: number
          name: string
          nummer: string
          p_schein: Json
          p_schein_gueltig_bis: string | null
          puenktlichkeit: number
          schicht: string
          standort: string
          status: string
          steuer_id: string | null
          sv_ausweis_vorhanden: boolean
          telefon: string
          ueberstunden: number
          umsatz_heute: number
          updated_at: string
          urlaubstage: number
          user_id: string | null
          vertragsart: string
        }
        Insert: {
          adresse?: string
          arbeitszeiten?: string
          beschaeftigungsart?: string
          beschwerden?: number
          bewertung?: number
          created_at?: string
          email?: string
          erste_hilfe?: Json
          fahrzeug?: string | null
          foto?: string | null
          fuehrerschein?: Json
          fuehrungszeugnis_datum?: string | null
          gewinn_heute?: number
          gps?: Json
          id?: string
          km_heute?: number
          krankheitstage?: number
          lob?: number
          monatsbrutto?: number
          name?: string
          nummer: string
          p_schein?: Json
          p_schein_gueltig_bis?: string | null
          puenktlichkeit?: number
          schicht?: string
          standort?: string
          status?: string
          steuer_id?: string | null
          sv_ausweis_vorhanden?: boolean
          telefon?: string
          ueberstunden?: number
          umsatz_heute?: number
          updated_at?: string
          urlaubstage?: number
          user_id?: string | null
          vertragsart?: string
        }
        Update: {
          adresse?: string
          arbeitszeiten?: string
          beschaeftigungsart?: string
          beschwerden?: number
          bewertung?: number
          created_at?: string
          email?: string
          erste_hilfe?: Json
          fahrzeug?: string | null
          foto?: string | null
          fuehrerschein?: Json
          fuehrungszeugnis_datum?: string | null
          gewinn_heute?: number
          gps?: Json
          id?: string
          km_heute?: number
          krankheitstage?: number
          lob?: number
          monatsbrutto?: number
          name?: string
          nummer?: string
          p_schein?: Json
          p_schein_gueltig_bis?: string | null
          puenktlichkeit?: number
          schicht?: string
          standort?: string
          status?: string
          steuer_id?: string | null
          sv_ausweis_vorhanden?: boolean
          telefon?: string
          ueberstunden?: number
          umsatz_heute?: number
          updated_at?: string
          urlaubstage?: number
          user_id?: string | null
          vertragsart?: string
        }
        Relationships: []
      }
      employment_audit_log: {
        Row: {
          akteur_user_id: string | null
          aktion: string
          created_at: string
          driver_id: string | null
          employment_id: string
          id: string
          new_row: Json | null
          old_row: Json | null
          version: number | null
        }
        Insert: {
          akteur_user_id?: string | null
          aktion: string
          created_at?: string
          driver_id?: string | null
          employment_id: string
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          version?: number | null
        }
        Update: {
          akteur_user_id?: string | null
          aktion?: string
          created_at?: string
          driver_id?: string | null
          employment_id?: string
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          version?: number | null
        }
        Relationships: []
      }
      employment_relationships: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string
          gueltig_ab: string
          gueltig_bis: string | null
          id: string
          monatsbrutto: number | null
          notiz: string
          status: string
          stundenlohn: number | null
          updated_at: string
          verguetungsart: string
          verified_at: string | null
          verified_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id: string
          gueltig_ab: string
          gueltig_bis?: string | null
          id?: string
          monatsbrutto?: number | null
          notiz?: string
          status?: string
          stundenlohn?: number | null
          updated_at?: string
          verguetungsart: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string
          gueltig_ab?: string
          gueltig_bis?: string | null
          id?: string
          monatsbrutto?: number | null
          notiz?: string
          status?: string
          stundenlohn?: number | null
          updated_at?: string
          verguetungsart?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "employment_relationships_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          beleg_dokument_id: string | null
          betrag_brutto: number
          created_at: string
          datum: string
          fahrer_id: string | null
          fahrzeug_id: string | null
          id: string
          kategorie: string
          lieferant: string
          notiz: string | null
          updated_at: string
          ust_satz: number
        }
        Insert: {
          beleg_dokument_id?: string | null
          betrag_brutto?: number
          created_at?: string
          datum?: string
          fahrer_id?: string | null
          fahrzeug_id?: string | null
          id?: string
          kategorie?: string
          lieferant?: string
          notiz?: string | null
          updated_at?: string
          ust_satz?: number
        }
        Update: {
          beleg_dokument_id?: string | null
          betrag_brutto?: number
          created_at?: string
          datum?: string
          fahrer_id?: string | null
          fahrzeug_id?: string | null
          id?: string
          kategorie?: string
          lieferant?: string
          notiz?: string | null
          updated_at?: string
          ust_satz?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_beleg_dokument_id_fkey"
            columns: ["beleg_dokument_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_fahrer_id_fkey"
            columns: ["fahrer_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_fahrzeug_id_fkey"
            columns: ["fahrzeug_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          adresse: string
          aktiv: boolean
          ansprechpartner: string
          created_at: string
          email: string | null
          fachbereiche: Json
          id: string
          kapazitaet: number | null
          kostentraeger: string | null
          name: string
          notiz: string | null
          oeffnungszeiten: string | null
          telefon: string
          typ: string
          updated_at: string
        }
        Insert: {
          adresse?: string
          aktiv?: boolean
          ansprechpartner?: string
          created_at?: string
          email?: string | null
          fachbereiche?: Json
          id?: string
          kapazitaet?: number | null
          kostentraeger?: string | null
          name: string
          notiz?: string | null
          oeffnungszeiten?: string | null
          telefon?: string
          typ?: string
          updated_at?: string
        }
        Update: {
          adresse?: string
          aktiv?: boolean
          ansprechpartner?: string
          created_at?: string
          email?: string | null
          fachbereiche?: Json
          id?: string
          kapazitaet?: number | null
          kostentraeger?: string | null
          name?: string
          notiz?: string | null
          oeffnungszeiten?: string | null
          telefon?: string
          typ?: string
          updated_at?: string
        }
        Relationships: []
      }
      ghasi_memory: {
        Row: {
          bezug: string | null
          created_at: string
          expires_at: string | null
          genehmigt: boolean
          id: string
          inhalt: string
          kategorie: string
          quelle: string
          typ: string
          updated_at: string
          user_id: string | null
          wichtigkeit: number
        }
        Insert: {
          bezug?: string | null
          created_at?: string
          expires_at?: string | null
          genehmigt?: boolean
          id?: string
          inhalt: string
          kategorie?: string
          quelle?: string
          typ?: string
          updated_at?: string
          user_id?: string | null
          wichtigkeit?: number
        }
        Update: {
          bezug?: string | null
          created_at?: string
          expires_at?: string | null
          genehmigt?: boolean
          id?: string
          inhalt?: string
          kategorie?: string
          quelle?: string
          typ?: string
          updated_at?: string
          user_id?: string | null
          wichtigkeit?: number
        }
        Relationships: []
      }
      insurance_policies: {
        Row: {
          ablauf: string
          art: string
          beginn: string
          beitrag_monat: number
          created_at: string
          fahrzeug: string
          id: string
          notiz: string | null
          policennummer: string
          selbstbeteiligung: number
          status: string
          updated_at: string
          versicherer: string
        }
        Insert: {
          ablauf?: string
          art?: string
          beginn?: string
          beitrag_monat?: number
          created_at?: string
          fahrzeug?: string
          id?: string
          notiz?: string | null
          policennummer?: string
          selbstbeteiligung?: number
          status?: string
          updated_at?: string
          versicherer?: string
        }
        Update: {
          ablauf?: string
          art?: string
          beginn?: string
          beitrag_monat?: number
          created_at?: string
          fahrzeug?: string
          id?: string
          notiz?: string | null
          policennummer?: string
          selbstbeteiligung?: number
          status?: string
          updated_at?: string
          versicherer?: string
        }
        Relationships: []
      }
      insurer_contracts: {
        Row: {
          aktenzeichen: string
          created_at: string
          einheit: string
          genehmigt: boolean
          gueltig_ab: string | null
          gueltig_bis: string | null
          id: string
          insurer_id: string
          leistung: string
          notiz: string
          preis: number
          updated_at: string
        }
        Insert: {
          aktenzeichen?: string
          created_at?: string
          einheit?: string
          genehmigt?: boolean
          gueltig_ab?: string | null
          gueltig_bis?: string | null
          id?: string
          insurer_id: string
          leistung?: string
          notiz?: string
          preis?: number
          updated_at?: string
        }
        Update: {
          aktenzeichen?: string
          created_at?: string
          einheit?: string
          genehmigt?: boolean
          gueltig_ab?: string | null
          gueltig_bis?: string | null
          id?: string
          insurer_id?: string
          leistung?: string
          notiz?: string
          preis?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurer_contracts_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
        ]
      }
      insurers: {
        Row: {
          created_at: string
          id: string
          kuerzel: string
          name: string
          updated_at: string
          vertragsstatus: string
        }
        Insert: {
          created_at?: string
          id?: string
          kuerzel?: string
          name: string
          updated_at?: string
          vertragsstatus?: string
        }
        Update: {
          created_at?: string
          id?: string
          kuerzel?: string
          name?: string
          updated_at?: string
          vertragsstatus?: string
        }
        Relationships: []
      }
      invoice_audit_snapshots: {
        Row: {
          changed_at: string
          id: string
          invoice_id: string
          new_row: Json
          old_row: Json
        }
        Insert: {
          changed_at?: string
          id?: string
          invoice_id: string
          new_row: Json
          old_row: Json
        }
        Update: {
          changed_at?: string
          id?: string
          invoice_id?: string
          new_row?: Json
          old_row?: Json
        }
        Relationships: [
          {
            foreignKeyName: "invoice_audit_snapshots_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_changes: {
        Row: {
          akteur: string | null
          alt_wert: string | null
          created_at: string
          feld: string
          id: string
          invoice_id: string
          invoice_nummer: string | null
          neu_wert: string | null
        }
        Insert: {
          akteur?: string | null
          alt_wert?: string | null
          created_at?: string
          feld: string
          id?: string
          invoice_id: string
          invoice_nummer?: string | null
          neu_wert?: string | null
        }
        Update: {
          akteur?: string | null
          alt_wert?: string | null
          created_at?: string
          feld?: string
          id?: string
          invoice_id?: string
          invoice_nummer?: string | null
          neu_wert?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_changes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          abrechnungsart: string
          betrag: number
          bezahlt_am: string | null
          bezahlter_betrag: number | null
          bezug_auftrag: string | null
          created_at: string
          datum: string
          faelligkeit: string
          id: string
          kunde: string
          kunde_id: string
          leistungsdatum: string | null
          letzte_mahnung: string | null
          mahn_historie: Json
          mahnstufe: number
          mwst_satz: number
          notiz: string | null
          nummer: string
          positionen: Json
          status: string
          typ: string
          updated_at: string
          zahlungen: Json
        }
        Insert: {
          abrechnungsart?: string
          betrag?: number
          bezahlt_am?: string | null
          bezahlter_betrag?: number | null
          bezug_auftrag?: string | null
          created_at?: string
          datum?: string
          faelligkeit?: string
          id?: string
          kunde?: string
          kunde_id?: string
          leistungsdatum?: string | null
          letzte_mahnung?: string | null
          mahn_historie?: Json
          mahnstufe?: number
          mwst_satz?: number
          notiz?: string | null
          nummer: string
          positionen?: Json
          status?: string
          typ?: string
          updated_at?: string
          zahlungen?: Json
        }
        Update: {
          abrechnungsart?: string
          betrag?: number
          bezahlt_am?: string | null
          bezahlter_betrag?: number | null
          bezug_auftrag?: string | null
          created_at?: string
          datum?: string
          faelligkeit?: string
          id?: string
          kunde?: string
          kunde_id?: string
          leistungsdatum?: string | null
          letzte_mahnung?: string | null
          mahn_historie?: Json
          mahnstufe?: number
          mwst_satz?: number
          notiz?: string | null
          nummer?: string
          positionen?: Json
          status?: string
          typ?: string
          updated_at?: string
          zahlungen?: Json
        }
        Relationships: []
      }
      leasing_contracts: {
        Row: {
          beginn: string
          created_at: string
          ende: string
          fahrzeug: string
          id: string
          km_aktuell: number
          km_inklusive: number
          laufzeit_monate: number
          leasinggeber: string
          notiz: string | null
          rate_monat: number
          restwert: number
          status: string
          updated_at: string
          vertragsnummer: string
        }
        Insert: {
          beginn?: string
          created_at?: string
          ende?: string
          fahrzeug?: string
          id?: string
          km_aktuell?: number
          km_inklusive?: number
          laufzeit_monate?: number
          leasinggeber?: string
          notiz?: string | null
          rate_monat?: number
          restwert?: number
          status?: string
          updated_at?: string
          vertragsnummer?: string
        }
        Update: {
          beginn?: string
          created_at?: string
          ende?: string
          fahrzeug?: string
          id?: string
          km_aktuell?: number
          km_inklusive?: number
          laufzeit_monate?: number
          leasinggeber?: string
          notiz?: string | null
          rate_monat?: number
          restwert?: number
          status?: string
          updated_at?: string
          vertragsnummer?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          abholanforderung: string
          abholort: string
          abrechnung_status: string
          begleitperson: boolean
          created_at: string
          dauerauftrag_id: string | null
          destination_additional_info: string
          destination_city: string
          destination_country: string
          destination_house_number: string
          destination_postal_code: string
          destination_street: string
          detail_status: string | null
          fahrer: string | null
          fahrer_id: string | null
          fahrer_user_id: string | null
          fahrzeug: string | null
          fahrzeug_id: string | null
          id: string
          insurer_id: string | null
          kostentraeger: string
          lifecycle: Json
          medizinische_notiz: string
          mobilitaet: string | null
          notiz: string
          nummer: string
          patient: string
          patient_id: string | null
          patientennotiz: string
          pickup_additional_info: string
          pickup_city: string
          pickup_country: string
          pickup_house_number: string
          pickup_postal_code: string
          pickup_street: string
          prioritaet: string
          status: string
          telefon: string
          termin: string
          transportart: string
          unterschrift: string | null
          updated_at: string
          verordnung: string
          verordnung_dokument_id: string | null
          verordnung_id: string | null
          zielanforderung: string
          zielort: string
        }
        Insert: {
          abholanforderung?: string
          abholort?: string
          abrechnung_status?: string
          begleitperson?: boolean
          created_at?: string
          dauerauftrag_id?: string | null
          destination_additional_info?: string
          destination_city?: string
          destination_country?: string
          destination_house_number?: string
          destination_postal_code?: string
          destination_street?: string
          detail_status?: string | null
          fahrer?: string | null
          fahrer_id?: string | null
          fahrer_user_id?: string | null
          fahrzeug?: string | null
          fahrzeug_id?: string | null
          id?: string
          insurer_id?: string | null
          kostentraeger?: string
          lifecycle?: Json
          medizinische_notiz?: string
          mobilitaet?: string | null
          notiz?: string
          nummer: string
          patient?: string
          patient_id?: string | null
          patientennotiz?: string
          pickup_additional_info?: string
          pickup_city?: string
          pickup_country?: string
          pickup_house_number?: string
          pickup_postal_code?: string
          pickup_street?: string
          prioritaet?: string
          status?: string
          telefon?: string
          termin?: string
          transportart?: string
          unterschrift?: string | null
          updated_at?: string
          verordnung?: string
          verordnung_dokument_id?: string | null
          verordnung_id?: string | null
          zielanforderung?: string
          zielort?: string
        }
        Update: {
          abholanforderung?: string
          abholort?: string
          abrechnung_status?: string
          begleitperson?: boolean
          created_at?: string
          dauerauftrag_id?: string | null
          destination_additional_info?: string
          destination_city?: string
          destination_country?: string
          destination_house_number?: string
          destination_postal_code?: string
          destination_street?: string
          detail_status?: string | null
          fahrer?: string | null
          fahrer_id?: string | null
          fahrer_user_id?: string | null
          fahrzeug?: string | null
          fahrzeug_id?: string | null
          id?: string
          insurer_id?: string | null
          kostentraeger?: string
          lifecycle?: Json
          medizinische_notiz?: string
          mobilitaet?: string | null
          notiz?: string
          nummer?: string
          patient?: string
          patient_id?: string | null
          patientennotiz?: string
          pickup_additional_info?: string
          pickup_city?: string
          pickup_country?: string
          pickup_house_number?: string
          pickup_postal_code?: string
          pickup_street?: string
          prioritaet?: string
          status?: string
          telefon?: string
          termin?: string
          transportart?: string
          unterschrift?: string | null
          updated_at?: string
          verordnung?: string
          verordnung_dokument_id?: string | null
          verordnung_id?: string | null
          zielanforderung?: string
          zielort?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_fahrer_id_fkey"
            columns: ["fahrer_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_fahrzeug_id_fkey"
            columns: ["fahrzeug_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_verordnung_id_fkey"
            columns: ["verordnung_id"]
            isOneToOne: false
            referencedRelation: "verordnungen"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          begleitperson: boolean
          created_at: string
          genehmigung_bis: string | null
          hinweis: string
          id: string
          kostentraeger: string
          kostentraeger_id: string | null
          medizinische_notiz: string | null
          mobilitaet: string
          name: string
          patientennotiz: string | null
          telefon: string
          updated_at: string
          verordnung_dokument_id: string | null
          verordnung_vorhanden: boolean
          versichertennummer: string | null
          zuzahlungsbefreit: boolean
          zuzahlungsbefreit_bis: string | null
        }
        Insert: {
          begleitperson?: boolean
          created_at?: string
          genehmigung_bis?: string | null
          hinweis?: string
          id?: string
          kostentraeger?: string
          kostentraeger_id?: string | null
          medizinische_notiz?: string | null
          mobilitaet?: string
          name: string
          patientennotiz?: string | null
          telefon?: string
          updated_at?: string
          verordnung_dokument_id?: string | null
          verordnung_vorhanden?: boolean
          versichertennummer?: string | null
          zuzahlungsbefreit?: boolean
          zuzahlungsbefreit_bis?: string | null
        }
        Update: {
          begleitperson?: boolean
          created_at?: string
          genehmigung_bis?: string | null
          hinweis?: string
          id?: string
          kostentraeger?: string
          kostentraeger_id?: string | null
          medizinische_notiz?: string | null
          mobilitaet?: string
          name?: string
          patientennotiz?: string | null
          telefon?: string
          updated_at?: string
          verordnung_dokument_id?: string | null
          verordnung_vorhanden?: boolean
          versichertennummer?: string | null
          zuzahlungsbefreit?: boolean
          zuzahlungsbefreit_bis?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_kostentraeger_id_fkey"
            columns: ["kostentraeger_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_verordnung_dokument_id_fkey"
            columns: ["verordnung_dokument_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_fact_audit_log: {
        Row: {
          akteur_user_id: string | null
          aktion: string
          created_at: string
          driver_id: string | null
          fact_id: string
          fakt_schluessel: string | null
          id: string
          new_row: Json | null
          old_row: Json | null
          version: number | null
        }
        Insert: {
          akteur_user_id?: string | null
          aktion: string
          created_at?: string
          driver_id?: string | null
          fact_id: string
          fakt_schluessel?: string | null
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          version?: number | null
        }
        Update: {
          akteur_user_id?: string | null
          aktion?: string
          created_at?: string
          driver_id?: string | null
          fact_id?: string
          fakt_schluessel?: string | null
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          version?: number | null
        }
        Relationships: []
      }
      payroll_facts: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string
          fakt_schluessel: string
          gueltig_ab: string
          gueltig_bis: string | null
          id: string
          notiz: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          version: number
          wert: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id: string
          fakt_schluessel: string
          gueltig_ab: string
          gueltig_bis?: string | null
          id?: string
          notiz?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
          wert: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string
          fakt_schluessel?: string
          gueltig_ab?: string
          gueltig_bis?: string | null
          id?: string
          notiz?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
          wert?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_facts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_rule_audit_log: {
        Row: {
          akteur_user_id: string | null
          aktion: string
          created_at: string
          id: string
          kennung: string | null
          new_row: Json | null
          old_row: Json | null
          rule_id: string
          version: number | null
        }
        Insert: {
          akteur_user_id?: string | null
          aktion: string
          created_at?: string
          id?: string
          kennung?: string | null
          new_row?: Json | null
          old_row?: Json | null
          rule_id: string
          version?: number | null
        }
        Update: {
          akteur_user_id?: string | null
          aktion?: string
          created_at?: string
          id?: string
          kennung?: string | null
          new_row?: Json | null
          old_row?: Json | null
          rule_id?: string
          version?: number | null
        }
        Relationships: []
      }
      payroll_rules: {
        Row: {
          benoetigter_fakt: string | null
          berechnungsart: string
          bezeichnung: string
          created_at: string
          created_by: string | null
          festbetrag: number | null
          gueltig_ab: string
          gueltig_bis: string | null
          id: string
          kategorie: string
          kennung: string
          notiz: string
          prozentsatz: number | null
          quelle: string
          quelle_version: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          version: number
        }
        Insert: {
          benoetigter_fakt?: string | null
          berechnungsart: string
          bezeichnung: string
          created_at?: string
          created_by?: string | null
          festbetrag?: number | null
          gueltig_ab: string
          gueltig_bis?: string | null
          id?: string
          kategorie: string
          kennung: string
          notiz?: string
          prozentsatz?: number | null
          quelle: string
          quelle_version: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Update: {
          benoetigter_fakt?: string | null
          berechnungsart?: string
          bezeichnung?: string
          created_at?: string
          created_by?: string | null
          festbetrag?: number | null
          gueltig_ab?: string
          gueltig_bis?: string | null
          id?: string
          kategorie?: string
          kennung?: string
          notiz?: string
          prozentsatz?: number | null
          quelle?: string
          quelle_version?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Relationships: []
      }
      payroll_run_audit_log: {
        Row: {
          akteur_user_id: string | null
          aktion: string
          created_at: string
          driver_id: string | null
          id: string
          new_row: Json | null
          old_row: Json | null
          periode_monat: string | null
          run_id: string
          version: number | null
        }
        Insert: {
          akteur_user_id?: string | null
          aktion: string
          created_at?: string
          driver_id?: string | null
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          periode_monat?: string | null
          run_id: string
          version?: number | null
        }
        Update: {
          akteur_user_id?: string | null
          aktion?: string
          created_at?: string
          driver_id?: string | null
          id?: string
          new_row?: Json | null
          old_row?: Json | null
          periode_monat?: string | null
          run_id?: string
          version?: number | null
        }
        Relationships: []
      }
      payroll_run_items: {
        Row: {
          basisbetrag: number
          berechnungsart: string
          betrag: number
          created_at: string
          festbetrag: number | null
          id: string
          kategorie: string
          prozentsatz: number | null
          quelle: string
          quelle_version: string
          regel_bezeichnung: string
          regel_kennung: string
          rule_id: string | null
          run_id: string
        }
        Insert: {
          basisbetrag: number
          berechnungsart: string
          betrag: number
          created_at?: string
          festbetrag?: number | null
          id?: string
          kategorie: string
          prozentsatz?: number | null
          quelle?: string
          quelle_version?: string
          regel_bezeichnung: string
          regel_kennung: string
          rule_id?: string | null
          run_id: string
        }
        Update: {
          basisbetrag?: number
          berechnungsart?: string
          betrag?: number
          created_at?: string
          festbetrag?: number | null
          id?: string
          kategorie?: string
          prozentsatz?: number | null
          quelle?: string
          quelle_version?: string
          regel_bezeichnung?: string
          regel_kennung?: string
          rule_id?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_run_items_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "payroll_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          ablehnung_grund: string | null
          berechnet_am: string | null
          berechnet_von: string | null
          brutto: number | null
          created_at: string
          created_by: string | null
          driver_id: string
          employment_id: string | null
          entschieden_am: string | null
          entschieden_von: string | null
          fehlende_punkte: Json
          freigegeben_am: string | null
          freigegeben_von: string | null
          id: string
          netto: number | null
          notiz: string
          periode_monat: string
          status: string
          stunden: number | null
          stundenlohn: number | null
          summe_abzuege: number | null
          summe_arbeitgeberkosten: number | null
          updated_at: string
          verguetungsart: string | null
          version: number
          vorgelegt_am: string | null
          vorgelegt_version: number | null
          vorgelegt_von: string | null
        }
        Insert: {
          ablehnung_grund?: string | null
          berechnet_am?: string | null
          berechnet_von?: string | null
          brutto?: number | null
          created_at?: string
          created_by?: string | null
          driver_id: string
          employment_id?: string | null
          entschieden_am?: string | null
          entschieden_von?: string | null
          fehlende_punkte?: Json
          freigegeben_am?: string | null
          freigegeben_von?: string | null
          id?: string
          netto?: number | null
          notiz?: string
          periode_monat: string
          status?: string
          stunden?: number | null
          stundenlohn?: number | null
          summe_abzuege?: number | null
          summe_arbeitgeberkosten?: number | null
          updated_at?: string
          verguetungsart?: string | null
          version?: number
          vorgelegt_am?: string | null
          vorgelegt_version?: number | null
          vorgelegt_von?: string | null
        }
        Update: {
          ablehnung_grund?: string | null
          berechnet_am?: string | null
          berechnet_von?: string | null
          brutto?: number | null
          created_at?: string
          created_by?: string | null
          driver_id?: string
          employment_id?: string | null
          entschieden_am?: string | null
          entschieden_von?: string | null
          fehlende_punkte?: Json
          freigegeben_am?: string | null
          freigegeben_von?: string | null
          id?: string
          netto?: number | null
          notiz?: string
          periode_monat?: string
          status?: string
          stunden?: number | null
          stundenlohn?: number | null
          summe_abzuege?: number | null
          summe_arbeitgeberkosten?: number | null
          updated_at?: string
          verguetungsart?: string | null
          version?: number
          vorgelegt_am?: string | null
          vorgelegt_version?: number | null
          vorgelegt_von?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_employment_id_fkey"
            columns: ["employment_id"]
            isOneToOne: false
            referencedRelation: "employment_relationships"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recurring_orders: {
        Row: {
          abholort: string
          begleitperson: boolean
          bevorzugter_fahrer: string | null
          bevorzugter_fahrer_id: string | null
          bevorzugtes_fahrzeug: string | null
          bevorzugtes_fahrzeug_id: string | null
          created_at: string
          destination_additional_info: string
          destination_city: string
          destination_country: string
          destination_house_number: string
          destination_postal_code: string
          destination_street: string
          end_datum: string | null
          feiertage_ueberspringen: boolean
          generierte_termine: string[]
          id: string
          insurer_id: string | null
          kategorie: string
          kennung: string
          kostentraeger: string
          krankenkasse: string
          medizinische_notiz: string
          mobilitaet: string
          notiz: string
          patient: string
          patient_id: string | null
          pause_bis: string | null
          pause_von: string | null
          pausiert: boolean
          pickup_additional_info: string
          pickup_city: string
          pickup_country: string
          pickup_house_number: string
          pickup_postal_code: string
          pickup_street: string
          rhythmus: string
          rueckfahrt: boolean
          rueckfahrtzeit: string | null
          start_datum: string
          terminzeit: string
          uebersprungene_termine: string[]
          updated_at: string
          verordnung_erforderlich: boolean
          wochentage: number[]
          zielort: string
        }
        Insert: {
          abholort?: string
          begleitperson?: boolean
          bevorzugter_fahrer?: string | null
          bevorzugter_fahrer_id?: string | null
          bevorzugtes_fahrzeug?: string | null
          bevorzugtes_fahrzeug_id?: string | null
          created_at?: string
          destination_additional_info?: string
          destination_city?: string
          destination_country?: string
          destination_house_number?: string
          destination_postal_code?: string
          destination_street?: string
          end_datum?: string | null
          feiertage_ueberspringen?: boolean
          generierte_termine?: string[]
          id?: string
          insurer_id?: string | null
          kategorie?: string
          kennung: string
          kostentraeger?: string
          krankenkasse?: string
          medizinische_notiz?: string
          mobilitaet?: string
          notiz?: string
          patient?: string
          patient_id?: string | null
          pause_bis?: string | null
          pause_von?: string | null
          pausiert?: boolean
          pickup_additional_info?: string
          pickup_city?: string
          pickup_country?: string
          pickup_house_number?: string
          pickup_postal_code?: string
          pickup_street?: string
          rhythmus?: string
          rueckfahrt?: boolean
          rueckfahrtzeit?: string | null
          start_datum?: string
          terminzeit?: string
          uebersprungene_termine?: string[]
          updated_at?: string
          verordnung_erforderlich?: boolean
          wochentage?: number[]
          zielort?: string
        }
        Update: {
          abholort?: string
          begleitperson?: boolean
          bevorzugter_fahrer?: string | null
          bevorzugter_fahrer_id?: string | null
          bevorzugtes_fahrzeug?: string | null
          bevorzugtes_fahrzeug_id?: string | null
          created_at?: string
          destination_additional_info?: string
          destination_city?: string
          destination_country?: string
          destination_house_number?: string
          destination_postal_code?: string
          destination_street?: string
          end_datum?: string | null
          feiertage_ueberspringen?: boolean
          generierte_termine?: string[]
          id?: string
          insurer_id?: string | null
          kategorie?: string
          kennung?: string
          kostentraeger?: string
          krankenkasse?: string
          medizinische_notiz?: string
          mobilitaet?: string
          notiz?: string
          patient?: string
          patient_id?: string | null
          pause_bis?: string | null
          pause_von?: string | null
          pausiert?: boolean
          pickup_additional_info?: string
          pickup_city?: string
          pickup_country?: string
          pickup_house_number?: string
          pickup_postal_code?: string
          pickup_street?: string
          rhythmus?: string
          rueckfahrt?: boolean
          rueckfahrtzeit?: string | null
          start_datum?: string
          terminzeit?: string
          uebersprungene_termine?: string[]
          updated_at?: string
          verordnung_erforderlich?: boolean
          wochentage?: number[]
          zielort?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_orders_bevorzugter_fahrer_id_fkey"
            columns: ["bevorzugter_fahrer_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_orders_bevorzugtes_fahrzeug_id_fkey"
            columns: ["bevorzugtes_fahrzeug_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_orders_insurer_id_fkey"
            columns: ["insurer_id"]
            isOneToOne: false
            referencedRelation: "insurers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_trips: {
        Row: {
          created_at: string
          datum: string
          fahrer: string
          id: string
          km_ende: number
          km_start: number
          notiz: string
          updated_at: string
          vehicle_id: string
          zweck: string
        }
        Insert: {
          created_at?: string
          datum: string
          fahrer?: string
          id?: string
          km_ende?: number
          km_start?: number
          notiz?: string
          updated_at?: string
          vehicle_id: string
          zweck?: string
        }
        Update: {
          created_at?: string
          datum?: string
          fahrer?: string
          id?: string
          km_ende?: number
          km_start?: number
          notiz?: string
          updated_at?: string
          vehicle_id?: string
          zweck?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          baujahr: number
          created_at: string
          dokumente: Json
          fahrer: string | null
          fotos: Json
          gps: Json
          id: string
          kennzeichen: string
          kilometerstand: number
          kosten_pro_km: number
          kraftstoff: string
          last_real_at: string | null
          last_real_lat: number | null
          last_real_lng: number | null
          leasing_ende: string
          leasingrate: number
          liegend_geeignet: boolean
          marke: string
          modell: string
          monatsgewinn: number
          monatsumsatz: number
          naechste_wartung: string
          notizen: string
          nummer: string
          oelwechsel_bei: number
          real_gps_at: string | null
          real_lat: number | null
          real_lng: number | null
          reichweite: number
          reifenstatus: string
          reparaturen: Json
          rollstuhl_geeignet: boolean
          sitzplaetze: number
          standort: string
          status: string
          tagesgewinn: number
          tagesumsatz: number
          tankstand: number
          tuev_bis: string
          typ: string
          updated_at: string
          verbrauch: number
          versicherung: string
          versicherung_bis: string
        }
        Insert: {
          baujahr?: number
          created_at?: string
          dokumente?: Json
          fahrer?: string | null
          fotos?: Json
          gps?: Json
          id?: string
          kennzeichen?: string
          kilometerstand?: number
          kosten_pro_km?: number
          kraftstoff?: string
          last_real_at?: string | null
          last_real_lat?: number | null
          last_real_lng?: number | null
          leasing_ende?: string
          leasingrate?: number
          liegend_geeignet?: boolean
          marke?: string
          modell?: string
          monatsgewinn?: number
          monatsumsatz?: number
          naechste_wartung?: string
          notizen?: string
          nummer?: string
          oelwechsel_bei?: number
          real_gps_at?: string | null
          real_lat?: number | null
          real_lng?: number | null
          reichweite?: number
          reifenstatus?: string
          reparaturen?: Json
          rollstuhl_geeignet?: boolean
          sitzplaetze?: number
          standort?: string
          status?: string
          tagesgewinn?: number
          tagesumsatz?: number
          tankstand?: number
          tuev_bis?: string
          typ?: string
          updated_at?: string
          verbrauch?: number
          versicherung?: string
          versicherung_bis?: string
        }
        Update: {
          baujahr?: number
          created_at?: string
          dokumente?: Json
          fahrer?: string | null
          fotos?: Json
          gps?: Json
          id?: string
          kennzeichen?: string
          kilometerstand?: number
          kosten_pro_km?: number
          kraftstoff?: string
          last_real_at?: string | null
          last_real_lat?: number | null
          last_real_lng?: number | null
          leasing_ende?: string
          leasingrate?: number
          liegend_geeignet?: boolean
          marke?: string
          modell?: string
          monatsgewinn?: number
          monatsumsatz?: number
          naechste_wartung?: string
          notizen?: string
          nummer?: string
          oelwechsel_bei?: number
          real_gps_at?: string | null
          real_lat?: number | null
          real_lng?: number | null
          reichweite?: number
          reifenstatus?: string
          reparaturen?: Json
          rollstuhl_geeignet?: boolean
          sitzplaetze?: number
          standort?: string
          status?: string
          tagesgewinn?: number
          tagesumsatz?: number
          tankstand?: number
          tuev_bis?: string
          typ?: string
          updated_at?: string
          verbrauch?: number
          versicherung?: string
          versicherung_bis?: string
        }
        Relationships: []
      }
      verordnungen: {
        Row: {
          anzahl_faelligkeiten: number | null
          arzt_bsnr: string
          arzt_lanr: string
          arzt_name: string
          ausstellungsdatum: string
          created_at: string
          dokument_id: string | null
          genehmigt_von_kasse: boolean
          genehmigungsnummer: string
          hin_rueckfahrt: boolean
          id: string
          ist_serie: boolean
          notiz: string
          patient_id: string | null
          seriengueltig_bis: string | null
          seriengueltig_von: string | null
          transportart: string
          updated_at: string
        }
        Insert: {
          anzahl_faelligkeiten?: number | null
          arzt_bsnr?: string
          arzt_lanr?: string
          arzt_name?: string
          ausstellungsdatum: string
          created_at?: string
          dokument_id?: string | null
          genehmigt_von_kasse?: boolean
          genehmigungsnummer?: string
          hin_rueckfahrt?: boolean
          id?: string
          ist_serie?: boolean
          notiz?: string
          patient_id?: string | null
          seriengueltig_bis?: string | null
          seriengueltig_von?: string | null
          transportart: string
          updated_at?: string
        }
        Update: {
          anzahl_faelligkeiten?: number | null
          arzt_bsnr?: string
          arzt_lanr?: string
          arzt_name?: string
          ausstellungsdatum?: string
          created_at?: string
          dokument_id?: string | null
          genehmigt_von_kasse?: boolean
          genehmigungsnummer?: string
          hin_rueckfahrt?: boolean
          id?: string
          ist_serie?: boolean
          notiz?: string
          patient_id?: string | null
          seriengueltig_bis?: string | null
          seriengueltig_von?: string | null
          transportart?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verordnungen_dokument_id_fkey"
            columns: ["dokument_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verordnungen_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_payroll_run_calculation: {
        Args: {
          p_brutto: number
          p_employment_id: string
          p_fehlende_punkte: Json
          p_items: Json
          p_netto: number
          p_run_id: string
          p_status: string
          p_stunden: number
          p_stundenlohn: number
          p_summe_abzuege: number
          p_summe_arbeitgeberkosten: number
          p_verguetungsart: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "disposition" | "finanz" | "fahrer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "disposition", "finanz", "fahrer"],
    },
  },
} as const
