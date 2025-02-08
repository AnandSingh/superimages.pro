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
          created_at: string | null
          direction: string
          id: string
          intent: Database["public"]["Enums"]["message_intent"] | null
          message_type: string
          parsed_data: Json | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp_message_id: string
        }
        Insert: {
          content: Json
          created_at?: string | null
          direction: string
          id?: string
          intent?: Database["public"]["Enums"]["message_intent"] | null
          message_type: string
          parsed_data?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_message_id: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          direction?: string
          id?: string
          intent?: Database["public"]["Enums"]["message_intent"] | null
          message_type?: string
          parsed_data?: Json | null
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
      whatsapp_users: {
        Row: {
          created_at: string | null
          first_name: string | null
          id: string
          last_active: string | null
          last_name: string | null
          phone_number: string
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_active?: string | null
          last_name?: string | null
          phone_number: string
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_active?: string | null
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
      [_ in never]: never
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
