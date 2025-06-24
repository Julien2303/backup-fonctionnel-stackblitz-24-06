// Utilise Supabase pour les données//
// fournit la liste des médecins//

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Doctor } from '../types';

export const useDoctors = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDoctors = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error: supabaseError } = await supabase
        .from('doctors')
        .select('*')
        .eq('is_active', true)
        .order('type', { ascending: true })
        .order('last_name', { ascending: true });

      if (supabaseError) throw supabaseError;

      setDoctors(data || []);
      setError(null);
    } catch (err) {
      console.error("Erreur chargement médecins:", err);
      setError("Échec du chargement des médecins");
      setDoctors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Chargement initial
  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  // Trouver un médecin par son ID
  const getDoctorById = useCallback((id: string): Doctor | undefined => {
    return doctors.find(d => d.id === id);
  }, [doctors]);

  return {
    doctors,
    isLoading,
    error,
    loadDoctors,
    getDoctorById
  };
};