// Utilise Supabase pour les machines//

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Machine } from '../types';

export const useMachines = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMachines = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error: supabaseError } = await supabase
        .from('machines')
        .select('*')
        .order('name', { ascending: true });

      if (supabaseError) throw supabaseError;

      setMachines(data || []);
      // Sélectionner toutes les machines par défaut
      setSelectedMachines(data?.map(m => m.id) || []);
      setError(null);
    } catch (err) {
      console.error("Erreur chargement machines:", err);
      setError("Échec du chargement des machines");
      setMachines([]);
      setSelectedMachines([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Basculer la sélection d'une machine
  const toggleMachine = useCallback((machineId: string) => {
    setSelectedMachines(prev =>
      prev.includes(machineId)
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    );
  }, []);

  // Basculer tout un site
  const toggleSite = useCallback((site: string) => {
    const siteMachines = machines
      .filter(m => m.site === site)
      .map(m => m.id);
    
    const allSelected = siteMachines.every(id => 
      selectedMachines.includes(id)
    );
    
    setSelectedMachines(prev =>
      allSelected
        ? prev.filter(id => !siteMachines.includes(id))
        : Array.from(new Set([...prev, ...siteMachines]))
    );
  }, [machines, selectedMachines]);

  // Chargement initial
  useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  return {
    machines,
    selectedMachines,
    isLoading,
    error,
    loadMachines,
    toggleMachine,
    toggleSite,
    setSelectedMachines
  };
};