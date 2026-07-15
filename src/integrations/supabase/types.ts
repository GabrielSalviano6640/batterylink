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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      batteries: {
        Row: {
          capacidade_kwh: number | null
          cep: string | null
          cidade: string | null
          classificacao:
            | Database["public"]["Enums"]["battery_classification"]
            | null
          code: string
          company_id: string | null
          created_at: string
          created_by: string | null
          diagnostico: Json
          endereco: string | null
          estado: string
          fabricante: string | null
          id: string
          modelo: string | null
          numero_serie: string | null
          observacoes: string | null
          origem: string
          owner_id: string
          peso_kg: number | null
          possui_avaria: boolean | null
          possui_risco_termico: boolean | null
          possui_vazamento: boolean | null
          qr_code_data: string | null
          quantidade: number
          quimica: string
          soh_percentual: number | null
          status: Database["public"]["Enums"]["battery_status"]
          tensao: number | null
          uf: string | null
          updated_at: string
          urgencia: string
        }
        Insert: {
          capacidade_kwh?: number | null
          cep?: string | null
          cidade?: string | null
          classificacao?:
            | Database["public"]["Enums"]["battery_classification"]
            | null
          code?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnostico?: Json
          endereco?: string | null
          estado: string
          fabricante?: string | null
          id?: string
          modelo?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          origem: string
          owner_id: string
          peso_kg?: number | null
          possui_avaria?: boolean | null
          possui_risco_termico?: boolean | null
          possui_vazamento?: boolean | null
          qr_code_data?: string | null
          quantidade?: number
          quimica: string
          soh_percentual?: number | null
          status?: Database["public"]["Enums"]["battery_status"]
          tensao?: number | null
          uf?: string | null
          updated_at?: string
          urgencia: string
        }
        Update: {
          capacidade_kwh?: number | null
          cep?: string | null
          cidade?: string | null
          classificacao?:
            | Database["public"]["Enums"]["battery_classification"]
            | null
          code?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          diagnostico?: Json
          endereco?: string | null
          estado?: string
          fabricante?: string | null
          id?: string
          modelo?: string | null
          numero_serie?: string | null
          observacoes?: string | null
          origem?: string
          owner_id?: string
          peso_kg?: number | null
          possui_avaria?: boolean | null
          possui_risco_termico?: boolean | null
          possui_vazamento?: boolean | null
          qr_code_data?: string | null
          quantidade?: number
          quimica?: string
          soh_percentual?: number | null
          status?: Database["public"]["Enums"]["battery_status"]
          tensao?: number | null
          uf?: string | null
          updated_at?: string
          urgencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "batteries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      battery_events: {
        Row: {
          actor_id: string | null
          battery_id: string
          created_at: string
          event_type: string
          id: string
          notes: string | null
        }
        Insert: {
          actor_id?: string | null
          battery_id: string
          created_at?: string
          event_type: string
          id?: string
          notes?: string | null
        }
        Update: {
          actor_id?: string | null
          battery_id?: string
          created_at?: string
          event_type?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battery_events_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "batteries"
            referencedColumns: ["id"]
          },
        ]
      }
      battery_files: {
        Row: {
          battery_id: string
          created_at: string
          id: string
          nome_arquivo: string
          storage_path: string
          tipo: string
          uploaded_by: string | null
        }
        Insert: {
          battery_id: string
          created_at?: string
          id?: string
          nome_arquivo: string
          storage_path: string
          tipo: string
          uploaded_by?: string | null
        }
        Update: {
          battery_id?: string
          created_at?: string
          id?: string
          nome_arquivo?: string
          storage_path?: string
          tipo?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battery_files_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "batteries"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          battery_id: string | null
          codigo_coleta: string | null
          created_at: string
          data_agendada: string | null
          data_coleta: string | null
          data_entrega: string | null
          data_solicitacao: string | null
          destino_endereco: string
          generator_organization_id: string | null
          id: string
          lot_id: string
          motorista: string | null
          observacoes: string | null
          operator_organization_id: string | null
          origem_endereco: string
          placa: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["collection_status"]
          transportadora_id: string | null
          updated_at: string
          veiculo: string | null
        }
        Insert: {
          battery_id?: string | null
          codigo_coleta?: string | null
          created_at?: string
          data_agendada?: string | null
          data_coleta?: string | null
          data_entrega?: string | null
          data_solicitacao?: string | null
          destino_endereco: string
          generator_organization_id?: string | null
          id?: string
          lot_id: string
          motorista?: string | null
          observacoes?: string | null
          operator_organization_id?: string | null
          origem_endereco: string
          placa?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["collection_status"]
          transportadora_id?: string | null
          updated_at?: string
          veiculo?: string | null
        }
        Update: {
          battery_id?: string | null
          codigo_coleta?: string | null
          created_at?: string
          data_agendada?: string | null
          data_coleta?: string | null
          data_entrega?: string | null
          data_solicitacao?: string | null
          destino_endereco?: string
          generator_organization_id?: string | null
          id?: string
          lot_id?: string
          motorista?: string | null
          observacoes?: string | null
          operator_organization_id?: string | null
          origem_endereco?: string
          placa?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["collection_status"]
          transportadora_id?: string | null
          updated_at?: string
          veiculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_generator_organization_id_fkey"
            columns: ["generator_organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_operator_organization_id_fkey"
            columns: ["operator_organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          cargo: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome_fantasia: string | null
          numero: string | null
          owner_id: string
          razao_social: string
          status: Database["public"]["Enums"]["org_status"]
          telefone: string | null
          tipo: Database["public"]["Enums"]["app_role"]
          tipo_organizacao: string | null
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_fantasia?: string | null
          numero?: string | null
          owner_id: string
          razao_social: string
          status?: Database["public"]["Enums"]["org_status"]
          telefone?: string | null
          tipo: Database["public"]["Enums"]["app_role"]
          tipo_organizacao?: string | null
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_fantasia?: string | null
          numero?: string | null
          owner_id?: string
          razao_social?: string
          status?: Database["public"]["Enums"]["org_status"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["app_role"]
          tipo_organizacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          battery_id: string | null
          created_at: string
          data_emissao: string | null
          data_validade: string | null
          emissor: string | null
          entity_id: string
          entity_type: string
          id: string
          kind: string
          lot_id: string | null
          numero_documento: string | null
          observacoes: string | null
          operation_id: string | null
          status: string | null
          tipo_documento: string | null
          uploaded_by: string
          url: string
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          battery_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_validade?: string | null
          emissor?: string | null
          entity_id: string
          entity_type: string
          id?: string
          kind: string
          lot_id?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          operation_id?: string | null
          status?: string | null
          tipo_documento?: string | null
          uploaded_by: string
          url: string
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          battery_id?: string | null
          created_at?: string
          data_emissao?: string | null
          data_validade?: string | null
          emissor?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          kind?: string
          lot_id?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          operation_id?: string | null
          status?: string | null
          tipo_documento?: string | null
          uploaded_by?: string
          url?: string
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_operation_fk"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          battery_id: string | null
          collection_id: string | null
          created_at: string
          descricao: string
          gravidade: string
          id: string
          operation_id: string | null
          registrado_por: string | null
          resolved_at: string | null
          resolvido_por: string | null
          status: string
          tipo: string
        }
        Insert: {
          battery_id?: string | null
          collection_id?: string | null
          created_at?: string
          descricao: string
          gravidade?: string
          id?: string
          operation_id?: string | null
          registrado_por?: string | null
          resolved_at?: string | null
          resolvido_por?: string | null
          status?: string
          tipo: string
        }
        Update: {
          battery_id?: string | null
          collection_id?: string | null
          created_at?: string
          descricao?: string
          gravidade?: string
          id?: string
          operation_id?: string | null
          registrado_por?: string | null
          resolved_at?: string | null
          resolvido_por?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          admin_notes: string | null
          cidade: string | null
          created_at: string
          documento: string | null
          email: string | null
          estado: string | null
          id: string
          payload: Json
          phone: string | null
          razao_social: string | null
          responsavel: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
        }
        Insert: {
          admin_notes?: string | null
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          payload?: Json
          phone?: string | null
          razao_social?: string | null
          responsavel?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source: string
          status?: string
        }
        Update: {
          admin_notes?: string | null
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          payload?: Json
          phone?: string | null
          razao_social?: string | null
          responsavel?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      lot_batteries: {
        Row: {
          battery_id: string
          created_at: string
          lot_id: string
        }
        Insert: {
          battery_id: string
          created_at?: string
          lot_id: string
        }
        Update: {
          battery_id?: string
          created_at?: string
          lot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_batteries_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: true
            referencedRelation: "batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_batteries_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          capacidade_total_kwh: number | null
          cidade: string | null
          classificacao: string | null
          code: string
          created_at: string
          created_by: string | null
          data_abertura_propostas: string | null
          data_encerramento_propostas: string | null
          descricao: string | null
          destino: Database["public"]["Enums"]["lot_destination"]
          id: string
          operador_id: string
          peso_total_kg: number | null
          quantidade_baterias: number | null
          quimica_predominante: string | null
          soh_medio: number | null
          status: Database["public"]["Enums"]["lot_status"]
          titulo: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          capacidade_total_kwh?: number | null
          cidade?: string | null
          classificacao?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          data_abertura_propostas?: string | null
          data_encerramento_propostas?: string | null
          descricao?: string | null
          destino: Database["public"]["Enums"]["lot_destination"]
          id?: string
          operador_id: string
          peso_total_kg?: number | null
          quantidade_baterias?: number | null
          quimica_predominante?: string | null
          soh_medio?: number | null
          status?: Database["public"]["Enums"]["lot_status"]
          titulo: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          capacidade_total_kwh?: number | null
          cidade?: string | null
          classificacao?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          data_abertura_propostas?: string | null
          data_encerramento_propostas?: string | null
          descricao?: string | null
          destino?: Database["public"]["Enums"]["lot_destination"]
          id?: string
          operador_id?: string
          peso_total_kg?: number | null
          quantidade_baterias?: number | null
          quimica_predominante?: string | null
          soh_medio?: number | null
          status?: Database["public"]["Enums"]["lot_status"]
          titulo?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          link: string | null
          organization_id: string | null
          read_at: string | null
          tipo: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          organization_id?: string | null
          read_at?: string | null
          tipo?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          organization_id?: string | null
          read_at?: string | null
          tipo?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          carrier_organization_id: string | null
          created_at: string
          generator_organization_id: string | null
          id: string
          lot_id: string
          modelo_comercial: string | null
          operator_organization_id: string | null
          proposal_id: string
          recycler_organization_id: string | null
          status: string
          taxa_plataforma: number | null
          updated_at: string
          valor_operacao: number | null
        }
        Insert: {
          carrier_organization_id?: string | null
          created_at?: string
          generator_organization_id?: string | null
          id?: string
          lot_id: string
          modelo_comercial?: string | null
          operator_organization_id?: string | null
          proposal_id: string
          recycler_organization_id?: string | null
          status?: string
          taxa_plataforma?: number | null
          updated_at?: string
          valor_operacao?: number | null
        }
        Update: {
          carrier_organization_id?: string | null
          created_at?: string
          generator_organization_id?: string | null
          id?: string
          lot_id?: string
          modelo_comercial?: string | null
          operator_organization_id?: string | null
          proposal_id?: string
          recycler_organization_id?: string | null
          status?: string
          taxa_plataforma?: number | null
          updated_at?: string
          valor_operacao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operations_carrier_organization_id_fkey"
            columns: ["carrier_organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_generator_organization_id_fkey"
            columns: ["generator_organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_operator_organization_id_fkey"
            columns: ["operator_organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operations_recycler_organization_id_fkey"
            columns: ["recycler_organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["org_member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["org_member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["org_member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_documents: {
        Row: {
          arquivo_url: string | null
          created_at: string
          id: string
          numero: string | null
          observacoes: string | null
          organization_id: string
          status_validacao: string
          tipo_documento: string
          validade: string | null
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string
          id?: string
          numero?: string | null
          observacoes?: string | null
          organization_id: string
          status_validacao?: string
          tipo_documento: string
          validade?: string | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string
          id?: string
          numero?: string | null
          observacoes?: string | null
          organization_id?: string
          status_validacao?: string
          tipo_documento?: string
          validade?: string | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aceite_consentimento_at: string | null
          aceite_privacidade_at: string | null
          aceite_termos_at: string | null
          avatar_url: string | null
          cargo: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          aceite_consentimento_at?: string | null
          aceite_privacidade_at?: string | null
          aceite_termos_at?: string | null
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          aceite_consentimento_at?: string | null
          aceite_privacidade_at?: string | null
          aceite_termos_at?: string | null
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          condicoes: string | null
          created_at: string
          destinacao_proposta: string | null
          id: string
          lot_id: string
          modelo_comercial: string | null
          moeda: string | null
          prazo_retirada_dias: number | null
          reciclador_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
          validade_proposta: string | null
          valor_total: number
        }
        Insert: {
          condicoes?: string | null
          created_at?: string
          destinacao_proposta?: string | null
          id?: string
          lot_id: string
          modelo_comercial?: string | null
          moeda?: string | null
          prazo_retirada_dias?: number | null
          reciclador_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          validade_proposta?: string | null
          valor_total: number
        }
        Update: {
          condicoes?: string | null
          created_at?: string
          destinacao_proposta?: string | null
          id?: string
          lot_id?: string
          modelo_comercial?: string | null
          moeda?: string | null
          prazo_retirada_dias?: number | null
          reciclador_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
          validade_proposta?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_requests: {
        Row: {
          admin_notes: string | null
          company_data: Json
          created_at: string
          id: string
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          company_data?: Json
          created_at?: string
          id?: string
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          company_data?: Json
          created_at?: string
          id?: string
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
      sorting_diagnostics: {
        Row: {
          battery_id: string
          capacidade_medida_kwh: number | null
          classificacao: string
          created_at: string
          data_diagnostico: string
          id: string
          integridade_estrutural: string | null
          observacoes: string | null
          operator_organization_id: string
          recomendacao_destino: string | null
          responsavel_tecnico: string | null
          risco_identificado: string | null
          soh_percentual: number | null
          status_validacao: string
          temperatura: number | null
          tensao_medida: number | null
          updated_at: string
        }
        Insert: {
          battery_id: string
          capacidade_medida_kwh?: number | null
          classificacao?: string
          created_at?: string
          data_diagnostico?: string
          id?: string
          integridade_estrutural?: string | null
          observacoes?: string | null
          operator_organization_id: string
          recomendacao_destino?: string | null
          responsavel_tecnico?: string | null
          risco_identificado?: string | null
          soh_percentual?: number | null
          status_validacao?: string
          temperatura?: number | null
          tensao_medida?: number | null
          updated_at?: string
        }
        Update: {
          battery_id?: string
          capacidade_medida_kwh?: number | null
          classificacao?: string
          created_at?: string
          data_diagnostico?: string
          id?: string
          integridade_estrutural?: string | null
          observacoes?: string | null
          operator_organization_id?: string
          recomendacao_destino?: string | null
          responsavel_tecnico?: string | null
          risco_identificado?: string | null
          soh_percentual?: number | null
          status_validacao?: string
          temperatura?: number | null
          tensao_medida?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sorting_diagnostics_battery_id_fkey"
            columns: ["battery_id"]
            isOneToOne: false
            referencedRelation: "batteries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sorting_diagnostics_operator_organization_id_fkey"
            columns: ["operator_organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      status_history: {
        Row: {
          alterado_por: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          justificativa: string | null
          organization_id: string | null
          status_anterior: string | null
          status_novo: string
        }
        Insert: {
          alterado_por?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          justificativa?: string | null
          organization_id?: string | null
          status_anterior?: string | null
          status_novo: string
        }
        Update: {
          alterado_por?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          justificativa?: string | null
          organization_id?: string | null
          status_anterior?: string | null
          status_novo?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_registration: {
        Args: { _approve: boolean; _notes?: string; _request_id: string }
        Returns: undefined
      }
      can_manage_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      deliver_collection: {
        Args: { _collection_id: string }
        Returns: undefined
      }
      finalize_battery: {
        Args: {
          _battery_id: string
          _final: Database["public"]["Enums"]["battery_status"]
        }
        Returns: undefined
      }
      get_org_member_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["org_member_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      next_battery_code: { Args: never; Returns: string }
      next_lot_code: { Args: never; Returns: string }
      notify_user: {
        Args: {
          _body: string
          _link?: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gerador"
        | "reciclador"
        | "transportadora"
        | "operador"
      battery_classification: "segunda_vida" | "reciclagem"
      battery_status:
        | "registered"
        | "triaging"
        | "classified"
        | "in_lot"
        | "collected"
        | "delivered"
        | "recycled"
        | "second_life"
        | "rejected"
      collection_status:
        | "available"
        | "accepted"
        | "in_transit"
        | "delivered"
        | "cancelled"
      lot_destination: "reciclagem" | "segunda_vida"
      lot_status:
        | "open"
        | "published"
        | "negotiating"
        | "awarded"
        | "shipped"
        | "closed"
      org_member_role:
        | "proprietario"
        | "gestor"
        | "operador"
        | "tecnico"
        | "financeiro"
        | "visualizador"
      org_status:
        | "cadastro_incompleto"
        | "aguardando_aprovacao"
        | "em_analise"
        | "aprovada"
        | "suspensa"
        | "rejeitada"
      proposal_status: "submitted" | "accepted" | "rejected" | "withdrawn"
      request_status: "pending" | "approved" | "rejected"
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
      app_role: [
        "admin",
        "gerador",
        "reciclador",
        "transportadora",
        "operador",
      ],
      battery_classification: ["segunda_vida", "reciclagem"],
      battery_status: [
        "registered",
        "triaging",
        "classified",
        "in_lot",
        "collected",
        "delivered",
        "recycled",
        "second_life",
        "rejected",
      ],
      collection_status: [
        "available",
        "accepted",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      lot_destination: ["reciclagem", "segunda_vida"],
      lot_status: [
        "open",
        "published",
        "negotiating",
        "awarded",
        "shipped",
        "closed",
      ],
      org_member_role: [
        "proprietario",
        "gestor",
        "operador",
        "tecnico",
        "financeiro",
        "visualizador",
      ],
      org_status: [
        "cadastro_incompleto",
        "aguardando_aprovacao",
        "em_analise",
        "aprovada",
        "suspensa",
        "rejeitada",
      ],
      proposal_status: ["submitted", "accepted", "rejected", "withdrawn"],
      request_status: ["pending", "approved", "rejected"],
    },
  },
} as const
