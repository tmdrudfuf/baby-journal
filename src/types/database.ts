
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_usage": {
                  Row: {
                    "created_at": string,"est_cost_usd": number,"family_id": string | null,"feature": string,"id": number,"input_tokens": number,"latency_ms": number,"model": string,"ok": boolean,"output_tokens": number,"provider": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"est_cost_usd"?: number,"family_id"?: string | null,"feature": string,"id"?: never,"input_tokens"?: number,"latency_ms"?: number,"model": string,"ok": boolean,"output_tokens"?: number,"provider": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"est_cost_usd"?: number,"family_id"?: string | null,"feature"?: string,"id"?: never,"input_tokens"?: number,"latency_ms"?: number,"model"?: string,"ok"?: boolean,"output_tokens"?: number,"provider"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"babies": {
                  Row: {
                    "birth_date": string | null,"created_at": string,"family_id": string,"id": string,"name": string
                  }
                  Insert: {
                    "birth_date"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "birth_date"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "babies_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"family_id": string,"id": string,"memory_id": string
                  }
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"family_id": string,"id"?: string,"memory_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"memory_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_profile_fk"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_memory_id_family_id_fkey"
      columns: ["memory_id","family_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"family_members": {
                  Row: {
                    "created_at": string,"family_id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["family_role"],"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"family_id": string,"revoked_at"?: string | null,"role": Database["public"]['Enums']["family_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["family_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_members_profile_fk"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"expires_at": string,"family_id": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["family_role"],"token_hash": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"expires_at": string,"family_id": string,"id"?: string,"invited_by"?: string | null,"role": Database["public"]['Enums']["family_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"expires_at"?: string,"family_id"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["family_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"media_deletions": {
                  Row: {
                    "created_at": string,"object_key": string
                  }
                  Insert: {
                    "created_at"?: string,"object_key": string
                  }
                  Update: {
                    "created_at"?: string,"object_key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"memories": {
                  Row: {
                    "ai_input_hash": string | null,"ai_status": string | null,"author_id": string | null,"baby_id": string,"created_at": string,"family_id": string,"id": string,"milestone_candidate": boolean,"milestone_title": string | null,"occurred_at": string,"raw_text": string | null,"story_text": string | null,"type": string,"updated_at": string,"visibility": string
                  }
                  Insert: {
                    "ai_input_hash"?: string | null,"ai_status"?: string | null,"author_id"?: string | null,"baby_id": string,"created_at"?: string,"family_id": string,"id"?: string,"milestone_candidate"?: boolean,"milestone_title"?: string | null,"occurred_at"?: string,"raw_text"?: string | null,"story_text"?: string | null,"type"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "ai_input_hash"?: string | null,"ai_status"?: string | null,"author_id"?: string | null,"baby_id"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"milestone_candidate"?: boolean,"milestone_title"?: string | null,"occurred_at"?: string,"raw_text"?: string | null,"story_text"?: string | null,"type"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memories_author_profile_fk"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memories_baby_id_family_id_fkey"
      columns: ["baby_id","family_id"]
isOneToOne: false
      referencedRelation: "babies"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"memory_assets": {
                  Row: {
                    "asset_type": string,"bytes": number | null,"created_at": string,"duration_ms": number | null,"family_id": string,"hash": string | null,"height": number | null,"id": string,"memory_id": string,"mime_type": string,"object_key": string,"storage_class": string,"variant": string,"width": number | null
                  }
                  Insert: {
                    "asset_type": string,"bytes"?: number | null,"created_at"?: string,"duration_ms"?: number | null,"family_id": string,"hash"?: string | null,"height"?: number | null,"id"?: string,"memory_id": string,"mime_type": string,"object_key": string,"storage_class"?: string,"variant": string,"width"?: number | null
                  }
                  Update: {
                    "asset_type"?: string,"bytes"?: number | null,"created_at"?: string,"duration_ms"?: number | null,"family_id"?: string,"hash"?: string | null,"height"?: number | null,"id"?: string,"memory_id"?: string,"mime_type"?: string,"object_key"?: string,"storage_class"?: string,"variant"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "memory_assets_memory_id_family_id_fkey"
      columns: ["memory_id","family_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"milestones": {
                  Row: {
                    "baby_id": string,"created_at": string,"created_by": string | null,"family_id": string,"id": string,"memory_id": string | null,"occurred_on": string,"title": string
                  }
                  Insert: {
                    "baby_id": string,"created_at"?: string,"created_by"?: string | null,"family_id": string,"id"?: string,"memory_id"?: string | null,"occurred_on": string,"title": string
                  }
                  Update: {
                    "baby_id"?: string,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"memory_id"?: string | null,"occurred_on"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_baby_id_family_id_fkey"
      columns: ["baby_id","family_id"]
isOneToOne: false
      referencedRelation: "babies"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "milestones_memory_id_family_id_fkey"
      columns: ["memory_id","family_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string
                  }
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reactions": {
                  Row: {
                    "created_at": string,"family_id": string,"kind": string,"memory_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"family_id": string,"kind"?: string,"memory_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"kind"?: string,"memory_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reactions_memory_id_family_id_fkey"
      columns: ["memory_id","family_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id","family_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "token": string }; Returns: string
                           },
"can_edit_memory":
{ Args: { "mid": string }; Returns: boolean
                           },
"create_family":
{ Args: { "family_name": string }; Returns: string
                           },
"create_invitation":
{ Args: { "fid": string,"invite_role": Database["public"]['Enums']["family_role"],"ttl"?: string }; Returns: string
                           },
"has_family_role":
{ Args: { "fid": string,"min_role": Database["public"]['Enums']["family_role"] }; Returns: boolean
                           }
          }
          Enums: {
            "family_role": "viewer"|"contributor"|"caregiver"|"owner"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "family_role": ["viewer", "contributor", "caregiver", "owner"]
          }
        }
} as const

