// Hand-maintained types mirroring the Supabase schema in supabase/migrations.
// Once the project is linked, these can be regenerated with:
//   npx supabase gen types typescript --linked > types/database.ts

export type UserRole = 'member' | 'admin';

export type MembershipStatus = 'active' | 'expiring_soon' | 'expired' | 'frozen';

export interface Profile {
  id: string; // matches auth.users.id
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Membership {
  id: string;
  member_id: string;
  plan_name: string;
  start_date: string; // date
  end_date: string; // date
  status: MembershipStatus;
  notes: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BmiRecord {
  id: string;
  member_id: string;
  recorded_at: string; // date
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  visceral_fat: number | null;
  notes: string | null;
  recorded_by: string; // admin/staff profile id
  created_at: string;
}

export interface ClassType {
  id: string;
  name: string; // Yoga, Boxing, Plank, Stretching, Zumba, Hyrox, ...
  description: string | null;
  color: string | null;
  is_active: boolean;
}

export type ClassRecurrence = 'once' | 'weekly';

export interface GymClass {
  id: string;
  class_type_id: string;
  trainer_name: string | null;
  title: string | null;
  day_of_week: number | null; // 0 (Sun) - 6 (Sat), used when recurrence = weekly
  session_date: string | null; // date, used when recurrence = once
  start_time: string; // time
  duration_minutes: number;
  capacity: number;
  recurrence: ClassRecurrence;
  is_active: boolean;
  created_at: string;
}

export type BookingStatus = 'booked' | 'waitlisted' | 'cancelled';

export interface ClassBooking {
  id: string;
  class_id: string;
  member_id: string;
  status: BookingStatus;
  booked_at: string;
}

export type TrainerSessionStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled';

export interface TrainerSession {
  id: string;
  member_id: string;
  trainer_name: string;
  requested_by: UserRole; // who initiated: member request vs admin assignment
  session_date: string;
  start_time: string;
  status: TrainerSessionStatus;
  notes: string | null;
  created_at: string;
}

export interface DietPlan {
  id: string;
  member_id: string;
  created_by: string;
  title: string;
  content: string; // structured/markdown meal plan text
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkoutPlan {
  id: string;
  member_id: string;
  created_by: string;
  title: string;
  content: string; // structured/markdown plan text (days, exercises, sets/reps)
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkoutLog {
  id: string;
  member_id: string;
  logged_at: string;
  exercise: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  notes: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  created_by: string;
  created_at: string;
}
