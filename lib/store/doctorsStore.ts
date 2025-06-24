'use client';
import { create } from 'zustand';
import { Doctor } from '../types/doctor';
import { supabase } from '../supabase/client';

interface DoctorsStore {
  doctors: Doctor[];
  loading: boolean;
  error: string | null;
  fetchDoctors: () => Promise<void>;
  addDoctor: (doctor: Omit<Doctor, 'id' | 'is_active' | 'created_at'>) => Promise<Doctor | undefined>;
  updateDoctor: (id: string, updates: Partial<Doctor>) => Promise<void>;
  removeDoctor: (id: string) => Promise<void>;
  resetError: () => void;
}

export const useDoctorsStore = create<DoctorsStore>((set, get) => ({
  doctors: [],
  loading: false,
  error: null,

  fetchDoctors: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('is_active', true)
        .order('last_name', { ascending: true });

      if (error) throw error;

      set({ doctors: data || [] });
    } catch (err) {
      console.error('Erreur lors du chargement des médecins:', err);
      set({ error: 'Impossible de charger les médecins' });
    } finally {
      set({ loading: false });
    }
  },

  addDoctor: async (doctor) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('doctors')
        .insert([{
          ...doctor,
          is_active: true,
          created_at: new Date().toISOString()
        }])
        .select();
  
      if (error) throw error;
  
      if (data?.[0]) {
        set((state) => ({ doctors: [...state.doctors, data[0]] }));
        return data[0];
      }
    } catch (err: any) {
      console.error("Erreur d'insertion:", err);
      console.log("Détails Supabase:", err.message, err.details);
      set({ error: "Erreur lors de l'ajout du médecin" });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  updateDoctor: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('doctors')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        doctors: state.doctors.map(d => 
          d.id === id ? { ...d, ...updates } : d
        )
      }));
    } catch (err) {
      console.error('Erreur lors de la mise à jour du médecin:', err);
      set({ error: 'Erreur lors de la mise à jour du médecin' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  removeDoctor: async (id) => {
    set({ loading: true, error: null });
    try {
      console.log(`Tentative de suppression du médecin avec ID: ${id}`);
      const { error } = await supabase
        .from('doctors')
        .update({ is_active: false })
        .eq('id', id);
      
      console.log('Réponse de suppression:', error ? 'Erreur' : 'Succès');
      
      if (error) {
        console.error("Détails de l'erreur:", error);
        throw error;
      }
      
      set((state) => ({
        doctors: state.doctors.filter(d => d.id !== id)
      }));
    } catch (err) {
      console.error('Erreur lors de la suppression du médecin:', err);
      const errorMessage = err instanceof Error ? err.message : 'Inconnue';
      set({ error: `Erreur lors de la suppression du médecin: ${errorMessage}` });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  resetError: () => set({ error: null })
}));