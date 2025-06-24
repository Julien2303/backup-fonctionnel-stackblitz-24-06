'use client';
import { create } from 'zustand';
import { Machine } from '../types/machines';
import { supabase } from '../supabase/client';

interface MachinesStore {
  machines: Machine[];
  loading: boolean;
  error: string | null;
  fetchMachines: () => Promise<void>;
  addMachine: (machine: Omit<Machine, 'id' | 'is_active' | 'created_at'>) => Promise<Machine | undefined>;
  updateMachine: (id: string, updates: Partial<Machine>) => Promise<void>;
  removeMachine: (id: string) => Promise<void>;
  resetError: () => void;
}

export const useMachinesStore = create<MachinesStore>((set) => ({
  machines: [],
  loading: false,
  error: null,

  // Récupérer toutes les machines actives
  fetchMachines: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      set({ machines: data || [] });
    } catch (err) {
      set({ error: 'Erreur lors du chargement des machines' });
    } finally {
      set({ loading: false });
    }
  },

  // Ajouter une nouvelle machine
  addMachine: async (machine) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('machines')
        .insert([{
          ...machine,
          is_active: true,
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      if (data?.[0]) {
        set((state) => ({ machines: [...state.machines, data[0]] }));
        return data[0];
      }
    } catch (err) {
      set({ error: "Erreur lors de l'ajout de la machine" });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Mettre à jour une machine
  updateMachine: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('machines')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      set((state) => ({
        machines: state.machines.map(m => 
          m.id === id ? { ...m, ...updates } : m
        )
      }));
    } catch (err) {
      set({ error: 'Erreur lors de la mise à jour' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  // Supprimer une machine (soft delete)
  removeMachine: async (id) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('machines')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      set((state) => ({
        machines: state.machines.filter(m => m.id !== id)
      }));
    } catch (err) {
      set({ error: 'Erreur lors de la suppression' });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  resetError: () => set({ error: null })
}));