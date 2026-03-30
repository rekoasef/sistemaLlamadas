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
      concesionario_telefonos: {
        Row: {
          concesionario_id: string | null
          id: string
          nombre_referencia: string | null
          numero_telefono: string
        }
        Insert: {
          concesionario_id?: string | null
          id?: string
          nombre_referencia?: string | null
          numero_telefono: string
        }
        Update: {
          concesionario_id?: string | null
          id?: string
          nombre_referencia?: string | null
          numero_telefono?: string
        }
        Relationships: [
          {
            foreignKeyName: "concesionario_telefonos_concesionario_id_fkey"
            columns: ["concesionario_id"]
            isOneToOne: false
            referencedRelation: "concesionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      concesionarios: {
        Row: {
          created_at: string | null
          id: string
          localidad: string | null
          nombre: string
          telefono_principal: string
          ciudad: string | null
          provincia: string | null
          latitud: number | null
          longitud: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          localidad?: string | null
          nombre: string
          telefono_principal: string
          ciudad?: string | null
          provincia?: string | null
          latitud?: number | null
          longitud?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          localidad?: string | null
          nombre?: string
          telefono_principal?: string
          ciudad?: string | null
          provincia?: string | null
          latitud?: number | null
          longitud?: number | null
        }
        Relationships: []
      }
      dispositivo_alias: {
        Row: {
          alias: string
          created_at: string | null
          dispositivo_id: string
          id: string
        }
        Insert: {
          alias: string
          created_at?: string | null
          dispositivo_id: string
          id?: string
        }
        Update: {
          alias?: string
          created_at?: string | null
          dispositivo_id?: string
          id?: string
        }
        Relationships: []
      }
      llamadas: {
        Row: {
          concesionario_id: string | null
          created_at: string | null
          dispositivo_id: string | null
          duracion_segundos: number | null
          estado: string | null
          fecha_llamada: string | null
          id: string
          numero_telefono: string | null
          tipo_llamada: string | null
        }
        Insert: {
          concesionario_id?: string | null
          created_at?: string | null
          dispositivo_id?: string | null
          duracion_segundos?: number | null
          estado?: string | null
          fecha_llamada?: string | null
          id?: string
          numero_telefono?: string | null
          tipo_llamada?: string | null
        }
        Update: {
          concesionario_id?: string | null
          created_at?: string | null
          dispositivo_id?: string | null
          duracion_segundos?: number | null
          estado?: string | null
          fecha_llamada?: string | null
          id?: string
          numero_telefono?: string | null
          tipo_llamada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_concesionario"
            columns: ["concesionario_id"]
            isOneToOne: false
            referencedRelation: "concesionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      reportes_generados: {
        Row: {
          creado_at: string | null
          id: string
          metricas: Json | null
          rango_fin: string
          rango_inicio: string
          resumen_escrito: string | null
          tipo: string | null
          titulo: string
        }
        Insert: {
          creado_at?: string | null
          id?: string
          metricas?: Json | null
          rango_fin: string
          rango_inicio: string
          resumen_escrito?: string | null
          tipo?: string | null
          titulo: string
        }
        Update: {
          creado_at?: string | null
          id?: string
          metricas?: Json | null
          rango_fin?: string
          rango_inicio?: string
          resumen_escrito?: string | null
          tipo?: string | null
          titulo?: string
        }
        Relationships: []
      }
    }
    Views: {
      reporte_semanal: {
        Row: {
          atendidas: number | null
          dispositivo_id: string | null
          tasa_efectividad: number | null
          total_llamadas: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      generar_informe_semanal_automatico: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
