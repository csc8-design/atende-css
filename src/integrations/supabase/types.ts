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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_departments: {
        Row: {
          agent_id: string
          department_id: string
          id: string
        }
        Insert: {
          agent_id: string
          department_id: string
          id?: string
        }
        Update: {
          agent_id?: string
          department_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_notification_log: {
        Row: {
          agent_id: string
          conversation_id: string
          id: string
          notified_at: string
        }
        Insert: {
          agent_id: string
          conversation_id: string
          id?: string
          notified_at?: string
        }
        Update: {
          agent_id?: string
          conversation_id?: string
          id?: string
          notified_at?: string
        }
        Relationships: []
      }
      ai_suggestions: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_used: boolean
          suggestion_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_used?: boolean
          suggestion_type?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_used?: boolean
          suggestion_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_contacts: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          read_at: string | null
          replied_at: string | null
          sent_at: string | null
          status: string
          whatsapp_message_id: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          read_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          read_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          batch_delay_seconds: number | null
          batch_size: number | null
          channel: string
          completed_at: string | null
          created_at: string
          created_by: string
          delivered_count: number | null
          description: string | null
          failed_count: number | null
          id: string
          name: string
          read_count: number | null
          replied_count: number | null
          scheduled_at: string | null
          send_rate_per_second: number | null
          sent_count: number | null
          started_at: string | null
          status: string
          template_category: string | null
          template_components: Json | null
          template_language: string | null
          template_name: string | null
          total_contacts: number | null
          updated_at: string
        }
        Insert: {
          batch_delay_seconds?: number | null
          batch_size?: number | null
          channel?: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          id?: string
          name: string
          read_count?: number | null
          replied_count?: number | null
          scheduled_at?: string | null
          send_rate_per_second?: number | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          template_category?: string | null
          template_components?: Json | null
          template_language?: string | null
          template_name?: string | null
          total_contacts?: number | null
          updated_at?: string
        }
        Update: {
          batch_delay_seconds?: number | null
          batch_size?: number | null
          channel?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          id?: string
          name?: string
          read_count?: number | null
          replied_count?: number | null
          scheduled_at?: string | null
          send_rate_per_second?: number | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          template_category?: string | null
          template_components?: Json | null
          template_language?: string | null
          template_name?: string | null
          total_contacts?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          is_favorite: boolean
          is_pinned: boolean
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          is_favorite?: boolean
          is_pinned?: boolean
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          is_favorite?: boolean
          is_pinned?: boolean
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "internal_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_configs: {
        Row: {
          auto_transfer_to_agent: boolean
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          max_tokens: number | null
          menu_options: Json | null
          model: string
          name: string
          system_prompt: string
          temperature: number | null
          transfer_keywords: string[] | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          auto_transfer_to_agent?: boolean
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_tokens?: number | null
          menu_options?: Json | null
          model?: string
          name: string
          system_prompt?: string
          temperature?: number | null
          transfer_keywords?: string[] | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          auto_transfer_to_agent?: boolean
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_tokens?: number | null
          menu_options?: Json | null
          model?: string
          name?: string
          system_prompt?: string
          temperature?: number | null
          transfer_keywords?: string[] | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_configs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_logs: {
        Row: {
          chatbot_config_id: string | null
          contact_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          messages: Json
          transferred_to_agent: boolean | null
          updated_at: string
        }
        Insert: {
          chatbot_config_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          transferred_to_agent?: boolean | null
          updated_at?: string
        }
        Update: {
          chatbot_config_id?: string | null
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          messages?: Json
          transferred_to_agent?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_logs_chatbot_config_id_fkey"
            columns: ["chatbot_config_id"]
            isOneToOne: false
            referencedRelation: "chatbot_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      closing_reasons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          usage_count?: number
        }
        Relationships: []
      }
      contact_interests: {
        Row: {
          brands: string[]
          contact_id: string
          created_at: string
          interest: string | null
          interest_type: string | null
          last_analyzed_at: string | null
          last_message_at: string | null
          models: string[]
          updated_at: string
        }
        Insert: {
          brands?: string[]
          contact_id: string
          created_at?: string
          interest?: string | null
          interest_type?: string | null
          last_analyzed_at?: string | null
          last_message_at?: string | null
          models?: string[]
          updated_at?: string
        }
        Update: {
          brands?: string[]
          contact_id?: string
          created_at?: string
          interest?: string | null
          interest_type?: string | null
          last_analyzed_at?: string | null
          last_message_at?: string | null
          models?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_interests_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          assigned_agent_id: string | null
          avatar_url: string | null
          category: Database["public"]["Enums"]["contact_category"] | null
          chatbot_name: string | null
          city: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string
          desired_equipment: string | null
          email: string | null
          id: string
          interest_type: string | null
          is_active: boolean
          is_reseller: boolean | null
          name: string
          notes: string | null
          part_of_interest: string | null
          phone: string
          segment: string | null
          state: string | null
          tags: string[] | null
          updated_at: string
          whatsapp_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          assigned_agent_id?: string | null
          avatar_url?: string | null
          category?: Database["public"]["Enums"]["contact_category"] | null
          chatbot_name?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          desired_equipment?: string | null
          email?: string | null
          id?: string
          interest_type?: string | null
          is_active?: boolean
          is_reseller?: boolean | null
          name: string
          notes?: string | null
          part_of_interest?: string | null
          phone: string
          segment?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string
          whatsapp_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          assigned_agent_id?: string | null
          avatar_url?: string | null
          category?: Database["public"]["Enums"]["contact_category"] | null
          chatbot_name?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          desired_equipment?: string | null
          email?: string | null
          id?: string
          interest_type?: string | null
          is_active?: boolean
          is_reseller?: boolean | null
          name?: string
          notes?: string | null
          part_of_interest?: string | null
          phone?: string
          segment?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string
          whatsapp_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      conversation_notes: {
        Row: {
          author_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reply_alerts: {
        Row: {
          conversation_id: string
          id: string
          last_message_at: string
          level: string
          notified_at: string
        }
        Insert: {
          conversation_id: string
          id?: string
          last_message_at: string
          level: string
          notified_at?: string
        }
        Update: {
          conversation_id?: string
          id?: string
          last_message_at?: string
          level?: string
          notified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reply_alerts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          conversation_id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_summary: string | null
          assigned_agent_id: string | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          closed_at: string | null
          closing_reason: string | null
          contact_id: string
          created_at: string
          department_id: string | null
          id: string
          last_message_at: string | null
          lead_score: string | null
          priority: number
          sentiment: string | null
          sentiment_score: number | null
          status: Database["public"]["Enums"]["conversation_status"]
          subject: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          assigned_agent_id?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          closed_at?: string | null
          closing_reason?: string | null
          contact_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          last_message_at?: string | null
          lead_score?: string | null
          priority?: number
          sentiment?: string | null
          sentiment_score?: number | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          assigned_agent_id?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          closed_at?: string | null
          closing_reason?: string | null
          contact_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          last_message_at?: string | null
          lead_score?: string | null
          priority?: number
          sentiment?: string | null
          sentiment_score?: number | null
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          assigned_agent_id: string | null
          company_name: string | null
          contact_id: string
          contact_name: string | null
          conversation_id: string
          created_at: string
          estimated_value: number | null
          id: string
          last_interaction_at: string
          next_contact_at: string | null
          notes: string | null
          priority: number
          stage_id: string
          status: string
          temperature: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          company_name?: string | null
          contact_id: string
          contact_name?: string | null
          conversation_id: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          last_interaction_at?: string
          next_contact_at?: string | null
          notes?: string | null
          priority?: number
          stage_id: string
          status?: string
          temperature?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          company_name?: string | null
          contact_id?: string
          contact_name?: string | null
          conversation_id?: string
          created_at?: string
          estimated_value?: number | null
          id?: string
          last_interaction_at?: string
          next_contact_at?: string | null
          notes?: string | null
          priority?: number
          stage_id?: string
          status?: string
          temperature?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          position: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          position?: number
        }
        Relationships: []
      }
      crm_tasks: {
        Row: {
          completed: boolean
          created_at: string
          created_by: string
          deal_id: string
          due_at: string | null
          id: string
          title: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          created_by: string
          deal_id: string
          due_at?: string | null
          id?: string
          title: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          created_by?: string
          deal_id?: string
          due_at?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      department_whatsapp_groups: {
        Row: {
          created_at: string
          department_id: string
          group_jid: string
          group_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          group_jid: string
          group_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          group_jid?: string
          group_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_whatsapp_groups_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: true
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string
          id: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string
          id?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string
          id?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      internal_channels: {
        Row: {
          avatar_url: string | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      internal_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          id: string
          is_edited: boolean
          media_url: string | null
          message_type: string
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean
          media_url?: string | null
          message_type?: string
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean
          media_url?: string | null
          message_type?: string
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "internal_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "internal_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_popagro: {
        Row: {
          atualizado_em: string | null
          cidade: string | null
          cnpj: string | null
          condicao: string | null
          created_at: string
          dados_json: Json | null
          data_lead: string | null
          email: string | null
          empresa: string | null
          id: string
          mensagem: string | null
          nome: string | null
          popagro_id: string
          produto_ano: string | null
          produto_foto: string | null
          produto_id: string | null
          produto_marca: string | null
          produto_modelo: string | null
          produto_nome: string | null
          produto_url: string | null
          produto_valor: number | null
          qualificado: boolean | null
          status: string | null
          telefone: string | null
          tipo_negociacao: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          atualizado_em?: string | null
          cidade?: string | null
          cnpj?: string | null
          condicao?: string | null
          created_at?: string
          dados_json?: Json | null
          data_lead?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          mensagem?: string | null
          nome?: string | null
          popagro_id: string
          produto_ano?: string | null
          produto_foto?: string | null
          produto_id?: string | null
          produto_marca?: string | null
          produto_modelo?: string | null
          produto_nome?: string | null
          produto_url?: string | null
          produto_valor?: number | null
          qualificado?: boolean | null
          status?: string | null
          telefone?: string | null
          tipo_negociacao?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          atualizado_em?: string | null
          cidade?: string | null
          cnpj?: string | null
          condicao?: string | null
          created_at?: string
          dados_json?: Json | null
          data_lead?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          mensagem?: string | null
          nome?: string | null
          popagro_id?: string
          produto_ano?: string | null
          produto_foto?: string | null
          produto_id?: string | null
          produto_marca?: string | null
          produto_modelo?: string | null
          produto_nome?: string | null
          produto_url?: string | null
          produto_valor?: number | null
          qualificado?: boolean | null
          status?: string | null
          telefone?: string | null
          tipo_negociacao?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mass_campaign_leads: {
        Row: {
          campaign_id: string
          cidade: string | null
          created_at: string
          email: string | null
          empresa: string | null
          error_message: string | null
          evolution_message_id: string | null
          extra: Json | null
          final_message: string | null
          first_sent_at: string | null
          fonte: string | null
          id: string
          manual_handoff: boolean
          manual_handoff_at: string | null
          manual_replied: boolean
          modelo: string | null
          nome: string | null
          prioridade: string | null
          replied_at: string | null
          score: number | null
          segmento: string | null
          sent_at: string | null
          status: string
          telefone: string
          telefone_normalizado: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          cidade?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          error_message?: string | null
          evolution_message_id?: string | null
          extra?: Json | null
          final_message?: string | null
          first_sent_at?: string | null
          fonte?: string | null
          id?: string
          manual_handoff?: boolean
          manual_handoff_at?: string | null
          manual_replied?: boolean
          modelo?: string | null
          nome?: string | null
          prioridade?: string | null
          replied_at?: string | null
          score?: number | null
          segmento?: string | null
          sent_at?: string | null
          status?: string
          telefone: string
          telefone_normalizado?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          cidade?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          error_message?: string | null
          evolution_message_id?: string | null
          extra?: Json | null
          final_message?: string | null
          first_sent_at?: string | null
          fonte?: string | null
          id?: string
          manual_handoff?: boolean
          manual_handoff_at?: string | null
          manual_replied?: boolean
          modelo?: string | null
          nome?: string | null
          prioridade?: string | null
          replied_at?: string | null
          score?: number | null
          segmento?: string | null
          sent_at?: string | null
          status?: string
          telefone?: string
          telefone_normalizado?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mass_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_campaigns: {
        Row: {
          channel: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          evolution_instance: string
          failed_count: number
          handoff_department_id: string | null
          id: string
          media_mime: string | null
          media_type: string | null
          media_url: string | null
          message_template: string | null
          meta_header_media_url: string | null
          meta_template_language: string | null
          meta_template_name: string | null
          name: string
          replied_count: number
          segment: string
          sent_count: number
          started_at: string | null
          status: string
          throttle_ms: number
          total_leads: number
          updated_at: string
        }
        Insert: {
          channel?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          evolution_instance?: string
          failed_count?: number
          handoff_department_id?: string | null
          id?: string
          media_mime?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template?: string | null
          meta_header_media_url?: string | null
          meta_template_language?: string | null
          meta_template_name?: string | null
          name: string
          replied_count?: number
          segment: string
          sent_count?: number
          started_at?: string | null
          status?: string
          throttle_ms?: number
          total_leads?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          evolution_instance?: string
          failed_count?: number
          handoff_department_id?: string | null
          id?: string
          media_mime?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template?: string | null
          meta_header_media_url?: string | null
          meta_template_language?: string | null
          meta_template_name?: string | null
          name?: string
          replied_count?: number
          segment?: string
          sent_count?: number
          started_at?: string | null
          status?: string
          throttle_ms?: number
          total_leads?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_campaigns_handoff_department_id_fkey"
            columns: ["handoff_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          media_url: string | null
          message_type: Database["public"]["Enums"]["message_type"]
          metadata: Json | null
          sender_id: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          whatsapp_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          metadata?: Json | null
          sender_id?: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          whatsapp_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"]
          metadata?: Json | null
          sender_id?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          reference_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prospect_leads: {
        Row: {
          assigned_agent_id: string | null
          city: string | null
          company_name: string
          contact_id: string | null
          contact_name: string | null
          created_at: string
          created_by: string
          email: string | null
          equipment_type: string | null
          estimated_value: number | null
          funnel_stage: string | null
          id: string
          interaction_status: string
          last_interaction_at: string | null
          loss_reason: string | null
          message_sent_at: string | null
          next_step: string | null
          observations: string | null
          phone: string
          responsible: string | null
          role: string | null
          segment: string | null
          source: string
          source_origin: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          city?: string | null
          company_name: string
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          equipment_type?: string | null
          estimated_value?: number | null
          funnel_stage?: string | null
          id?: string
          interaction_status?: string
          last_interaction_at?: string | null
          loss_reason?: string | null
          message_sent_at?: string | null
          next_step?: string | null
          observations?: string | null
          phone: string
          responsible?: string | null
          role?: string | null
          segment?: string | null
          source?: string
          source_origin?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          city?: string | null
          company_name?: string
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          equipment_type?: string | null
          estimated_value?: number | null
          funnel_stage?: string | null
          id?: string
          interaction_status?: string
          last_interaction_at?: string | null
          loss_reason?: string | null
          message_sent_at?: string | null
          next_step?: string | null
          observations?: string | null
          phone?: string
          responsible?: string | null
          role?: string | null
          segment?: string | null
          source?: string
          source_origin?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      qual_conversations: {
        Row: {
          archived: boolean
          assigned_agent_id: string | null
          contact_avatar_url: string | null
          contact_name: string | null
          created_at: string
          evolution_instance: string | null
          finished_at: string | null
          finished_by: string | null
          handoff_summary: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          metadata: Json
          phone: string
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          assigned_agent_id?: string | null
          contact_avatar_url?: string | null
          contact_name?: string | null
          created_at?: string
          evolution_instance?: string | null
          finished_at?: string | null
          finished_by?: string | null
          handoff_summary?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json
          phone: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          assigned_agent_id?: string | null
          contact_avatar_url?: string | null
          contact_name?: string | null
          created_at?: string
          evolution_instance?: string | null
          finished_at?: string | null
          finished_by?: string | null
          handoff_summary?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json
          phone?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      qual_lead_qualification: {
        Row: {
          ai_summary: string | null
          conversation_id: string
          criteria: Json
          disqualified: boolean
          last_analyzed_at: string | null
          last_message_count: number
          lead_data: Json
          score: number
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          conversation_id: string
          criteria?: Json
          disqualified?: boolean
          last_analyzed_at?: string | null
          last_message_count?: number
          lead_data?: Json
          score?: number
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          conversation_id?: string
          criteria?: Json
          disqualified?: boolean
          last_analyzed_at?: string | null
          last_message_count?: number
          lead_data?: Json
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qual_lead_qualification_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "qual_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      qual_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          evolution_message_id: string | null
          id: string
          media_type: string | null
          media_url: string | null
          metadata: Json
          sender_name: string | null
          sent_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          evolution_message_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          metadata?: Json
          sender_name?: string | null
          sent_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          evolution_message_id?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          metadata?: Json
          sender_name?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qual_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "qual_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          is_global: boolean
          shortcut: string | null
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_global?: boolean
          shortcut?: string | null
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          is_global?: boolean
          shortcut?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_ratings: {
        Row: {
          agent_id: string | null
          comment: string | null
          contact_id: string
          conversation_id: string
          created_at: string
          department_id: string | null
          id: string
          rating: number | null
          requested_at: string
          responded_at: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          agent_id?: string | null
          comment?: string | null
          contact_id: string
          conversation_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          rating?: number | null
          requested_at?: string
          responded_at?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          agent_id?: string | null
          comment?: string | null
          contact_id?: string
          conversation_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          rating?: number | null
          requested_at?: string
          responded_at?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_ratings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_ratings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_ratings_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          agent_id: string
          contact_id: string | null
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          duration_minutes: number
          google_event_id: string | null
          id: string
          notes: string | null
          schedule_type: string
          scheduled_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          contact_id?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          duration_minutes?: number
          google_event_id?: string | null
          id?: string
          notes?: string | null
          schedule_type?: string
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          duration_minutes?: number
          google_event_id?: string | null
          id?: string
          notes?: string | null
          schedule_type?: string
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      tenant_api_configs: {
        Row: {
          config_key: string
          config_value: string
          created_at: string | null
          id: string
          is_active: boolean | null
          provider: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_api_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          description: string | null
          due_date: string | null
          id: string
          invoice_url: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          reference_month: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reference_month?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reference_month?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          custom_domain: string | null
          document: string | null
          email: string | null
          favicon_url: string | null
          id: string
          is_active: boolean | null
          login_subtitle: string | null
          login_title: string | null
          logo_url: string | null
          max_conversations: number | null
          max_users: number | null
          name: string
          notes: string | null
          phone: string | null
          plan: string | null
          platform_name: string | null
          primary_color: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_domain?: string | null
          document?: string | null
          email?: string | null
          favicon_url?: string | null
          id?: string
          is_active?: boolean | null
          login_subtitle?: string | null
          login_title?: string | null
          logo_url?: string | null
          max_conversations?: number | null
          max_users?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          plan?: string | null
          platform_name?: string | null
          primary_color?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_domain?: string | null
          document?: string | null
          email?: string | null
          favicon_url?: string | null
          id?: string
          is_active?: boolean | null
          login_subtitle?: string | null
          login_title?: string | null
          logo_url?: string | null
          max_conversations?: number | null
          max_users?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          plan?: string | null
          platform_name?: string | null
          primary_color?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      cleanup_old_messages: { Args: never; Returns: undefined }
      close_conversation: {
        Args: { _closing_reason: string; _conversation_id: string }
        Returns: undefined
      }
      get_or_create_dm_channel: {
        Args: { other_user_id: string }
        Returns: string
      }
      has_crm_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_channel_admin: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      recalc_mass_campaign_counters: {
        Args: { _campaign_id: string }
        Returns: undefined
      }
      transfer_conversation: {
        Args: {
          _agent_id?: string
          _conversation_id: string
          _department_id: string
          _status?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "agent"
      channel_type: "group" | "direct" | "department"
      contact_category: "bronze" | "prata" | "ouro" | "diamante" | "vip"
      conversation_channel: "whatsapp" | "instagram" | "telegram" | "webchat"
      conversation_status: "open" | "pending" | "resolved" | "closed"
      message_sender_type: "contact" | "agent" | "system"
      message_type:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "document"
        | "location"
        | "sticker"
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
      app_role: ["admin", "manager", "agent"],
      channel_type: ["group", "direct", "department"],
      contact_category: ["bronze", "prata", "ouro", "diamante", "vip"],
      conversation_channel: ["whatsapp", "instagram", "telegram", "webchat"],
      conversation_status: ["open", "pending", "resolved", "closed"],
      message_sender_type: ["contact", "agent", "system"],
      message_type: [
        "text",
        "image",
        "audio",
        "video",
        "document",
        "location",
        "sticker",
      ],
    },
  },
} as const
