export type Modality = 'IRM' | 'Scanner' | 'Échographie' | 'Radiographie' | 'Mammographie' | 'Autre';
export type Site = 'Principal' | 'Annexe 1' | 'Annexe 2' | 'Externe';

export interface Machine {
  id: string;
  name: string;
  site?: Site | string; // Optionnel
  modality?: Modality | string; // Optionnel
  is_active: boolean;
  created_at: string;
}