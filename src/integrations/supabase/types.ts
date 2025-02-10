export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      command_definitions: {
        Row: {
          command: string
          created_at: string | null
          description: string
          id: string
          parameters: Json | null
          type: string
        }
        Insert: {
          command: string
          created_at?: string | null
          description: string
          id?: string
          parameters?: Json | null
          type: string
        }
        Update: {
          command?: string
          created_at?: string | null
          description?: string
          id?: string
          parameters?: Json | null
          type?: string
        }
        Relationships: []
      }
      credit_products: {
        Row: {
          created_at: string | null
          credits_amount: number
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          price: number
        }
        Insert: {
          created_at?: string | null
          credits_amount: number
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          price: number
        }
        Update: {
          created_at?: string | null
          credits_amount?: number
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          metadata: Json | null
          product_type: Database["public"]["Enums"]["product_type"]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          product_type: Database["public"]["Enums"]["product_type"]
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          product_type?: Database["public"]["Enums"]["product_type"]
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_summaries: {
        Row: {
          category_totals: Json
          created_at: string | null
          end_date: string
          id: string
          last_updated: string | null
          start_date: string
          timeframe: string
          total_amount: number
          user_id: string
        }
        Insert: {
          category_totals?: Json
          created_at?: string | null
          end_date: string
          id?: string
          last_updated?: string | null
          start_date: string
          timeframe: string
          total_amount?: number
          user_id: string
        }
        Update: {
          category_totals?: Json
          created_at?: string | null
          end_date?: string
          id?: string
          last_updated?: string | null
          start_date?: string
          timeframe?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"] | null
          created_at: string | null
          date: string | null
          description: string | null
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["expense_category"] | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"] | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          created_at: string | null
          filename: string | null
          id: string
          mime_type: string | null
          type: string
          url: string | null
          whatsapp_id: string | null
        }
        Insert: {
          created_at?: string | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          type: string
          url?: string | null
          whatsapp_id?: string | null
        }
        Update: {
          created_at?: string | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          type?: string
          url?: string | null
          whatsapp_id?: string | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          components: Json
          created_at: string | null
          id: string
          language: string
          name: string
          status: string
        }
        Insert: {
          components: Json
          created_at?: string | null
          id?: string
          language: string
          name: string
          status: string
        }
        Update: {
          components?: Json
          created_at?: string | null
          id?: string
          language?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: Json
          conversation_context: Json | null
          created_at: string | null
          direction: string
          id: string
          intent: Database["public"]["Enums"]["message_intent"] | null
          last_processed_at: string | null
          message_type: string
          parsed_data: Json | null
          processed: boolean | null
          processing_attempts: number | null
          processing_metadata: Json | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp_message_id: string
        }
        Insert: {
          content: Json
          conversation_context?: Json | null
          created_at?: string | null
          direction: string
          id?: string
          intent?: Database["public"]["Enums"]["message_intent"] | null
          last_processed_at?: string | null
          message_type: string
          parsed_data?: Json | null
          processed?: boolean | null
          processing_attempts?: number | null
          processing_metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_message_id: string
        }
        Update: {
          content?: Json
          conversation_context?: Json | null
          created_at?: string | null
          direction?: string
          id?: string
          intent?: Database["public"]["Enums"]["message_intent"] | null
          last_processed_at?: string | null
          message_type?: string
          parsed_data?: Json | null
          processed?: boolean | null
          processing_attempts?: number | null
          processing_metadata?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_users: {
        Row: {
          created_at: string | null
          first_name: string | null
          id: string
          last_active: string | null
          last_image_context: Json | null
          last_interaction_type: string | null
          last_name: string | null
          phone_number: string
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_active?: string | null
          last_image_context?: Json | null
          last_interaction_type?: string | null
          last_name?: string | null
          phone_number: string
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_active?: string | null
          last_image_context?: Json | null
          last_interaction_type?: string | null
          last_name?: string | null
          phone_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_user_credits: {
        Args: {
          p_user_id: string
          p_amount: number
          p_transaction_type: Database["public"]["Enums"]["transaction_type"]
          p_product_type: Database["public"]["Enums"]["product_type"]
          p_metadata?: Json
        }
        Returns: undefined
      }
      get_user_credits: {
        Args: {
          p_phone_number: string
        }
        Returns: number
      }
      use_credits: {
        Args: {
          p_user_id: string
          p_amount: number
          p_product_type: Database["public"]["Enums"]["product_type"]
          p_metadata?: Json
        }
        Returns: boolean
      }
    }
    Enums: {
      expense_category:
        | "groceries"
        | "restaurant"
        | "entertainment"
        | "transport"
        | "utilities"
        | "shopping"
        | "other"
      message_intent:
        | "RECORD_EXPENSE"
        | "QUERY_EXPENSES"
        | "MODIFY_EXPENSE"
        | "OTHER"
        | "FINANCIAL_ADVICE"
        | "CLARIFICATION"
        | "CONVERSATION"
      product_type: "image_generation"
      transaction_type: "purchase" | "usage" | "refund" | "bonus"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
