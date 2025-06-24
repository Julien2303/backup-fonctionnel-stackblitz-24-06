export type DoctorType = 'associé' | 'remplaçant';

export interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  initials: string;
  email: string;
  type: DoctorType;
  color: string;
  is_active: boolean;
  created_at?: string;
  deleted_at?: string;
}