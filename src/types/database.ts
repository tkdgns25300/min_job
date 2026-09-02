// ⚠️ **자동 생성 파일 — 손으로 고치지 말 것.**
//
// Supabase가 실제 DB 스키마를 읽어 만든다. 스키마가 바뀌면 다시 생성한다
// (MCP `generate_typescript_types` 또는 `supabase gen types typescript`).
// 정본은 DB이고, DB의 정본은 `docs/DATA.md` + `supabase/migrations/`다.
//
// ⚠️ `types/domain.ts`와 **다른 것**이다 — 여기는 **DB 행의 모양**, 그쪽은 **화면이 쓰는 모양**이다.
//    `lib/queries/*`(seam)가 둘을 잇는다. 페이지가 이 파일을 직접 import하지 않는다.
//
// ⚠️ enum 컬럼이 `string`으로 나온다 — DB가 `text + CHECK`라 Postgres enum 타입이 없기
//    때문이다(DATA §1: 허용값이 늘 때 `ALTER TYPE` 없이 CHECK만 갈기 위한 선택).
//    좁은 타입은 `constants/domain.ts`가 갖고 있고, seam에서 좁혀 넘긴다.
//
// ⚠️ 크롤러 4테이블(`source_data`·`review_data`·`source_health`·`crawl_run`)도 들어 있다 —
//    같은 DB에 살지만 **소유·마이그레이션은 min_job_agent**다(DATA §12). 우리는 읽고,
//    `review_data`는 검수 화면에서 고친다.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      bookmarks: {
        Row: {
          created_at: string;
          job_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          job_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          job_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmarks_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      church_links: {
        Row: {
          church_id: string;
          id: string;
          type: string;
          url: string;
        };
        Insert: {
          church_id: string;
          id?: string;
          type: string;
          url: string;
        };
        Update: {
          church_id?: string;
          id?: string;
          type?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "church_links_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
        ];
      };
      church_photos: {
        Row: {
          church_id: string;
          id: string;
          sort_order: number;
          url: string;
        };
        Insert: {
          church_id: string;
          id?: string;
          sort_order?: number;
          url: string;
        };
        Update: {
          church_id?: string;
          id?: string;
          sort_order?: number;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "church_photos_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
        ];
      };
      churches: {
        Row: {
          address: string | null;
          city: string | null;
          contact_email: string | null;
          contact_tel: string | null;
          created_at: string;
          denomination: string | null;
          founded_year: number | null;
          id: string;
          name: string;
          region: string | null;
          registration_no: string;
          verification_status: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_tel?: string | null;
          created_at?: string;
          denomination?: string | null;
          founded_year?: number | null;
          id?: string;
          name: string;
          region?: string | null;
          registration_no: string;
          verification_status?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          contact_email?: string | null;
          contact_tel?: string | null;
          created_at?: string;
          denomination?: string | null;
          founded_year?: number | null;
          id?: string;
          name?: string;
          region?: string | null;
          registration_no?: string;
          verification_status?: string;
        };
        Relationships: [];
      };
      crawl_run: {
        Row: {
          error_detail: Json;
          finished_at: string | null;
          id: string;
          mode: string;
          new_count: number;
          sources_failed: number;
          sources_ok: number;
          started_at: string;
        };
        Insert: {
          error_detail?: Json;
          finished_at?: string | null;
          id?: string;
          mode: string;
          new_count?: number;
          sources_failed?: number;
          sources_ok?: number;
          started_at: string;
        };
        Update: {
          error_detail?: Json;
          finished_at?: string | null;
          id?: string;
          mode?: string;
          new_count?: number;
          sources_failed?: number;
          sources_ok?: number;
          started_at?: string;
        };
        Relationships: [];
      };
      job_promotions: {
        Row: {
          amount: number;
          created_at: string;
          ends_at: string;
          id: string;
          job_id: string;
          payment_id: string;
          starts_at: string;
          status: string;
          tier: string;
          weeks: number;
        };
        Insert: {
          amount: number;
          created_at?: string;
          ends_at: string;
          id?: string;
          job_id: string;
          payment_id: string;
          starts_at: string;
          status: string;
          tier: string;
          weeks: number;
        };
        Update: {
          amount?: number;
          created_at?: string;
          ends_at?: string;
          id?: string;
          job_id?: string;
          payment_id?: string;
          starts_at?: string;
          status?: string;
          tier?: string;
          weeks?: number;
        };
        Relationships: [
          {
            foreignKeyName: "job_promotions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          address: string | null;
          benefit_note: string | null;
          church_id: string | null;
          church_name: string;
          city: string | null;
          contact_email: string | null;
          contact_link: string | null;
          contact_post: string | null;
          contact_tel: string | null;
          created_at: string;
          deadline: string | null;
          denomination: string | null;
          department: string | null;
          description: string;
          employment_type: string | null;
          featured_from: string | null;
          featured_tier: string;
          featured_until: string | null;
          headcount: string | null;
          housing_note: string | null;
          housing_provided: boolean | null;
          id: string;
          job_kind: string[];
          optional_docs: string[];
          pay_max: number | null;
          pay_min: number | null;
          pay_note: string | null;
          pay_period: string;
          position: string[] | null;
          posted_at: string;
          preferred: string[];
          process_steps: string[];
          qualification: string | null;
          region: string | null;
          required_docs: string[];
          requirements: string[];
          role: string | null;
          source: string;
          source_url: string | null;
          start_timing: string | null;
          status: string;
          title: string;
          updated_at: string;
          work_days: string | null;
        };
        Insert: {
          address?: string | null;
          benefit_note?: string | null;
          church_id?: string | null;
          church_name: string;
          city?: string | null;
          contact_email?: string | null;
          contact_link?: string | null;
          contact_post?: string | null;
          contact_tel?: string | null;
          created_at?: string;
          deadline?: string | null;
          denomination?: string | null;
          department?: string | null;
          description: string;
          employment_type?: string | null;
          featured_from?: string | null;
          featured_tier?: string;
          featured_until?: string | null;
          headcount?: string | null;
          housing_note?: string | null;
          housing_provided?: boolean | null;
          id?: string;
          job_kind: string[];
          optional_docs?: string[];
          pay_max?: number | null;
          pay_min?: number | null;
          pay_note?: string | null;
          pay_period?: string;
          position?: string[] | null;
          posted_at: string;
          preferred?: string[];
          process_steps?: string[];
          qualification?: string | null;
          region?: string | null;
          required_docs?: string[];
          requirements?: string[];
          role?: string | null;
          source: string;
          source_url?: string | null;
          start_timing?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          work_days?: string | null;
        };
        Update: {
          address?: string | null;
          benefit_note?: string | null;
          church_id?: string | null;
          church_name?: string;
          city?: string | null;
          contact_email?: string | null;
          contact_link?: string | null;
          contact_post?: string | null;
          contact_tel?: string | null;
          created_at?: string;
          deadline?: string | null;
          denomination?: string | null;
          department?: string | null;
          description?: string;
          employment_type?: string | null;
          featured_from?: string | null;
          featured_tier?: string;
          featured_until?: string | null;
          headcount?: string | null;
          housing_note?: string | null;
          housing_provided?: boolean | null;
          id?: string;
          job_kind?: string[];
          optional_docs?: string[];
          pay_max?: number | null;
          pay_min?: number | null;
          pay_note?: string | null;
          pay_period?: string;
          position?: string[] | null;
          posted_at?: string;
          preferred?: string[];
          process_steps?: string[];
          qualification?: string | null;
          region?: string | null;
          required_docs?: string[];
          requirements?: string[];
          role?: string | null;
          source?: string;
          source_url?: string | null;
          start_timing?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          work_days?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
        ];
      };
      review_data: {
        Row: {
          address: string | null;
          benefit_note: string | null;
          church_name: string | null;
          city: string | null;
          confidence: string;
          contact_email: string | null;
          contact_link: string | null;
          contact_post: string | null;
          contact_tel: string | null;
          created_at: string;
          deadline: string | null;
          dedup_key: string | null;
          dedup_state: string | null;
          denomination: string | null;
          denomination_evidence: string | null;
          denomination_source: string;
          department: string | null;
          description: string | null;
          employment_type: string | null;
          headcount: string | null;
          heresy_evidence: string | null;
          heresy_flag: boolean;
          housing_note: string | null;
          housing_provided: boolean | null;
          id: string;
          is_church_recruitment: string;
          job_kind: string[];
          optional_docs: string[];
          pay_max: number | null;
          pay_min: number | null;
          pay_note: string | null;
          pay_period: string | null;
          position: string[];
          posted_at: string;
          poster_paths: string[];
          preferred: string[];
          process_steps: string[];
          published_job_id: string | null;
          qualification: string | null;
          raw_denomination: string | null;
          region: string | null;
          reject_reason: string | null;
          required_docs: string[];
          requirements: string[];
          review_note: string | null;
          review_status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          role: string | null;
          run_id: string;
          source_data_id: string;
          source_url: string;
          start_timing: string | null;
          title: string | null;
          work_days: string | null;
        };
        Insert: {
          address?: string | null;
          benefit_note?: string | null;
          church_name?: string | null;
          city?: string | null;
          confidence: string;
          contact_email?: string | null;
          contact_link?: string | null;
          contact_post?: string | null;
          contact_tel?: string | null;
          created_at?: string;
          deadline?: string | null;
          dedup_key?: string | null;
          dedup_state?: string | null;
          denomination?: string | null;
          denomination_evidence?: string | null;
          denomination_source: string;
          department?: string | null;
          description?: string | null;
          employment_type?: string | null;
          headcount?: string | null;
          heresy_evidence?: string | null;
          heresy_flag?: boolean;
          housing_note?: string | null;
          housing_provided?: boolean | null;
          id?: string;
          is_church_recruitment: string;
          job_kind?: string[];
          optional_docs?: string[];
          pay_max?: number | null;
          pay_min?: number | null;
          pay_note?: string | null;
          pay_period?: string | null;
          position?: string[];
          posted_at: string;
          poster_paths?: string[];
          preferred?: string[];
          process_steps?: string[];
          published_job_id?: string | null;
          qualification?: string | null;
          raw_denomination?: string | null;
          region?: string | null;
          reject_reason?: string | null;
          required_docs?: string[];
          requirements?: string[];
          review_note?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          role?: string | null;
          run_id: string;
          source_data_id: string;
          source_url: string;
          start_timing?: string | null;
          title?: string | null;
          work_days?: string | null;
        };
        Update: {
          address?: string | null;
          benefit_note?: string | null;
          church_name?: string | null;
          city?: string | null;
          confidence?: string;
          contact_email?: string | null;
          contact_link?: string | null;
          contact_post?: string | null;
          contact_tel?: string | null;
          created_at?: string;
          deadline?: string | null;
          dedup_key?: string | null;
          dedup_state?: string | null;
          denomination?: string | null;
          denomination_evidence?: string | null;
          denomination_source?: string;
          department?: string | null;
          description?: string | null;
          employment_type?: string | null;
          headcount?: string | null;
          heresy_evidence?: string | null;
          heresy_flag?: boolean;
          housing_note?: string | null;
          housing_provided?: boolean | null;
          id?: string;
          is_church_recruitment?: string;
          job_kind?: string[];
          optional_docs?: string[];
          pay_max?: number | null;
          pay_min?: number | null;
          pay_note?: string | null;
          pay_period?: string | null;
          position?: string[];
          posted_at?: string;
          poster_paths?: string[];
          preferred?: string[];
          process_steps?: string[];
          published_job_id?: string | null;
          qualification?: string | null;
          raw_denomination?: string | null;
          region?: string | null;
          reject_reason?: string | null;
          required_docs?: string[];
          requirements?: string[];
          review_note?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          role?: string | null;
          run_id?: string;
          source_data_id?: string;
          source_url?: string;
          start_timing?: string | null;
          title?: string | null;
          work_days?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "review_data_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "crawl_run";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_data_source_data_id_fkey";
            columns: ["source_data_id"];
            isOneToOne: true;
            referencedRelation: "source_data";
            referencedColumns: ["id"];
          },
        ];
      };
      source_data: {
        Row: {
          attachments: Json;
          content_hash: string | null;
          external_id: string;
          fetched_at: string;
          id: string;
          image_urls: string[];
          last_structure_error: string | null;
          posted_on: string;
          raw_html: string;
          raw_meta: Json;
          raw_text: string;
          run_id: string;
          source_key: string;
          source_url: string;
          structure_attempts: number;
          structured_at: string | null;
          title: string;
        };
        Insert: {
          attachments?: Json;
          content_hash?: string | null;
          external_id: string;
          fetched_at: string;
          id?: string;
          image_urls?: string[];
          last_structure_error?: string | null;
          posted_on: string;
          raw_html?: string;
          raw_meta?: Json;
          raw_text: string;
          run_id: string;
          source_key: string;
          source_url: string;
          structure_attempts?: number;
          structured_at?: string | null;
          title: string;
        };
        Update: {
          attachments?: Json;
          content_hash?: string | null;
          external_id?: string;
          fetched_at?: string;
          id?: string;
          image_urls?: string[];
          last_structure_error?: string | null;
          posted_on?: string;
          raw_html?: string;
          raw_meta?: Json;
          raw_text?: string;
          run_id?: string;
          source_key?: string;
          source_url?: string;
          structure_attempts?: number;
          structured_at?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_data_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "crawl_run";
            referencedColumns: ["id"];
          },
        ];
      };
      source_health: {
        Row: {
          consecutive_empty_runs: number;
          consecutive_failures: number;
          first_run_at: string;
          last_cutoff: string | null;
          last_error: string | null;
          last_new_count: number;
          last_posted_on: string | null;
          last_rows: number;
          last_run_at: string;
          last_run_id: string | null;
          last_status: string;
          last_success_at: string | null;
          source_key: string;
          total_collected: number;
        };
        Insert: {
          consecutive_empty_runs?: number;
          consecutive_failures?: number;
          first_run_at: string;
          last_cutoff?: string | null;
          last_error?: string | null;
          last_new_count?: number;
          last_posted_on?: string | null;
          last_rows?: number;
          last_run_at: string;
          last_run_id?: string | null;
          last_status: string;
          last_success_at?: string | null;
          source_key: string;
          total_collected?: number;
        };
        Update: {
          consecutive_empty_runs?: number;
          consecutive_failures?: number;
          first_run_at?: string;
          last_cutoff?: string | null;
          last_error?: string | null;
          last_new_count?: number;
          last_posted_on?: string | null;
          last_rows?: number;
          last_run_at?: string;
          last_run_id?: string | null;
          last_status?: string;
          last_success_at?: string | null;
          source_key?: string;
          total_collected?: number;
        };
        Relationships: [
          {
            foreignKeyName: "source_health_last_run_id_fkey";
            columns: ["last_run_id"];
            isOneToOne: false;
            referencedRelation: "crawl_run";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          church_id: string | null;
          church_verification_status: string | null;
          created_at: string;
          email: string;
          id: string;
          verification_applicant_name: string | null;
          verification_applicant_position: string | null;
          verification_contact_email: string | null;
          verification_consent_at: string | null;
          verification_consent_version: string | null;
          verification_contact_tel: string | null;
          verification_doc_path: string | null;
          verification_rejection_reason: string | null;
          verification_reviewed_at: string | null;
          verification_submitted_at: string | null;
        };
        Insert: {
          church_id?: string | null;
          church_verification_status?: string | null;
          created_at?: string;
          email: string;
          id: string;
          verification_applicant_name?: string | null;
          verification_applicant_position?: string | null;
          verification_contact_email?: string | null;
          verification_consent_at?: string | null;
          verification_consent_version?: string | null;
          verification_contact_tel?: string | null;
          verification_doc_path?: string | null;
          verification_rejection_reason?: string | null;
          verification_reviewed_at?: string | null;
          verification_submitted_at?: string | null;
        };
        Update: {
          church_id?: string | null;
          church_verification_status?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          verification_applicant_name?: string | null;
          verification_applicant_position?: string | null;
          verification_contact_email?: string | null;
          verification_consent_at?: string | null;
          verification_consent_version?: string | null;
          verification_contact_tel?: string | null;
          verification_doc_path?: string | null;
          verification_rejection_reason?: string | null;
          verification_reviewed_at?: string | null;
          verification_submitted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "users_church_id_fkey";
            columns: ["church_id"];
            isOneToOne: false;
            referencedRelation: "churches";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
