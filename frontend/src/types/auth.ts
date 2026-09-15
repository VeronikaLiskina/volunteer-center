export interface AuthUser {
  id: number;
  phone: string | null;
  full_name: string;
  role: "COORDINATOR" | "VOLUNTEER";
  is_active: boolean;
  volunteer_id: number | null;
}
export interface LoginResult { access_token: string; token_type: string; user: AuthUser }
