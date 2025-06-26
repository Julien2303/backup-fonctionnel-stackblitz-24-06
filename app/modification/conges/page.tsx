"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';

interface Doctor {
  id: string;
  initials: string;
  color: string;
  first_name: string;
  last_name: string;
}

interface Conge {
  id?: string;
  doctor_id: string;
  date: string;
  is_conge: boolean;
}

interface Garde {
  date: string;
  jour: string;
  jour_ferie: boolean;
  noel: boolean;
  nouvel_an: boolean;
}

export default function CongesPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [conges, setConges] = useState<Conge[]>([]);
  const [gardes, setGardes] = useState<Garde[]>([]);
  const [loading, setLoading] = useState(false);
  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion']);

  // Fonction pour calculer le numéro de semaine ISO - déplacée dans useCallback
  const getISOWeekNumber = useCallback((date: Date): number => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const firstMonday = new Date(firstThursday);
    firstMonday.setDate(firstThursday.getDate() - (firstThursday.getDay() || 7) + 1);
    const weekNumber = Math.round((d.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    
    if (weekNumber < 1) {
      const prevYear = new Date(d.getFullYear() - 1, 0, 4);
      const prevYearFirstMonday = new Date(prevYear);
      prevYearFirstMonday.setDate(prevYear.getDate() - (prevYear.getDay() || 7) + 1);
      return Math.round((d.getTime() - prevYearFirstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    }
    return weekNumber;
  }, []);

  // Générer les jours de l'année - déplacée dans useCallback
  const generateDays = useCallback((year: number) => {
    const firstThursday = new Date(year, 0, 4);
    const firstMonday = new Date(firstThursday);
    firstMonday.setDate(firstThursday.getDate() - (firstThursday.getDay() || 7) + 1);
    
    const nextYearFirstThursday = new Date(year + 1, 0, 4);
    const nextYearFirstMonday = new Date(nextYearFirstThursday);
    nextYearFirstMonday.setDate(nextYearFirstThursday.getDate() - (nextYearFirstThursday.getDay() || 7) + 1);
    const lastSunday = new Date(nextYearFirstMonday);
    lastSunday.setDate(nextYearFirstMonday.getDate() - 1);
    
    const days = [];
    let currentDate = new Date(firstMonday);

    while (currentDate <= lastSunday) {
      const weekNumber = getISOWeekNumber(currentDate);
      days.push({ 
        date: new Date(currentDate), 
        weekNumber: weekNumber
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
  }, [getISOWeekNumber]);

  // Utiliser useMemo pour les jours
  const days = useMemo(() => generateDays(selectedYear), [generateDays, selectedYear]);

  // Fonction pour formater une date au format YYYY-MM-DD
  const formatDateForDB = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Récupérer les médecins associés
  useEffect(() => {
    async function fetchDoctors() {
      try {
        const { data, error } = await supabase
          .from('doctors')
          .select('id, first_name, last_name, initials, color')
          .eq('type', 'associé')
          .eq('is_active', true);

        if (error) {
          console.error('Erreur lors de la récupération des médecins:', error);
          return;
        }
        setDoctors(data || []);
      } catch (err) {
        console.error('Erreur inattendue:', err);
      }
    }
    
    if (!authLoading && !authError) {
      fetchDoctors();
    }
  }, [authLoading, authError]);

  // Récupérer les congés et les gardes pour l'année sélectionnée
  useEffect(() => {
    async function fetchData() {
      if (authLoading || authError) return;
      
      setLoading(true);
      
      try {
        const allDays = generateDays(selectedYear);
        const startDate = formatDateForDB(allDays[0].date);
        const endDate = formatDateForDB(allDays[allDays.length - 1].date);

        // Récupérer les congés et gardes en parallèle avec Promise.all
        const [congesResult, gardesResult] = await Promise.all([
          supabase
            .from('conges')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate),
          supabase
            .from('gardes')
            .select('date, jour, jour_ferie, noel, nouvel_an')
            .gte('date', startDate)
            .lte('date', endDate)
        ]);

        if (congesResult.error) {
          console.error('Erreur lors de la récupération des congés:', congesResult.error);
        } else {
          setConges(congesResult.data || []);
        }

        if (gardesResult.error) {
          console.error('Erreur lors de la récupération des gardes:', gardesResult.error);
        } else {
          setGardes(gardesResult.data || []);
        }
      } catch (err) {
        console.error('Erreur inattendue lors de la récupération des données:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [selectedYear, authLoading, authError, generateDays, formatDateForDB]);

  // Créer ou mettre à jour un congé
  const upsertConge = useCallback(async (conge: Conge) => {
    try {
      const { data, error } = await supabase
        .from('conges')
        .upsert(conge, { onConflict: 'doctor_id,date' })
        .select()
        .single();

      if (error) {
        console.error('Erreur lors de la mise à jour du congé:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Erreur inattendue lors de la mise à jour:', err);
      return null;
    }
  }, []);

  // Gérer le clic pour basculer l'état d'un congé
  const toggleConge = useCallback(async (dateStr: string, doctorId: string) => {
    const existingConge = conges.find(c => c.date === dateStr && c.doctor_id === doctorId);
    const newConge: Conge = {
      id: existingConge?.id || undefined,
      doctor_id: doctorId,
      date: dateStr,
      is_conge: !existingConge?.is_conge
    };

    const updatedConge = await upsertConge(newConge);
    if (updatedConge) {
      setConges(prev => {
        const index = prev.findIndex(c => c.date === dateStr && c.doctor_id === doctorId);
        if (index >= 0) {
          const newConges = [...prev];
          newConges[index] = updatedConge;
          return newConges;
        }
        return [...prev, updatedConge];
      });
    } else if (existingConge && !newConge.is_conge) {
      try {
        // Supprimer le congé si is_conge devient false
        const { error: deleteError } = await supabase
          .from('conges')
          .delete()
          .eq('doctor_id', doctorId)
          .eq('date', dateStr);
        
        if (deleteError) {
          console.error('Erreur lors de la suppression du congé:', deleteError);
          return;
        }
        
        setConges(prev => prev.filter(c => !(c.date === dateStr && c.doctor_id === doctorId)));
      } catch (err) {
        console.error('Erreur inattendue lors de la suppression:', err);
      }
    }
  }, [conges, upsertConge]);

  // Calculer le total des congés par médecin
  const getTotalConges = useCallback((doctorId: string) => {
    return conges.filter(c => c.doctor_id === doctorId && c.is_conge).length;
  }, [conges]);

  // Générer les options d'années - utiliser useMemo
  const years = useMemo(() => Array.from({ length: 10 }, (_, i) => 2025 + i), []);

  // Les retours conditionnels doivent venir APRÈS tous les hooks
  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }

  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  if (loading) {
    return <div className="p-4 text-center">Chargement des congés...</div>;
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Gestion des Congés</h1>

      {/* Sélection de l'année */}
      <div className="mb-4">
        <label htmlFor="year-select" className="mr-2">Année :</label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="p-2 border rounded"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Tableau des congés */}
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-200 z-10 shadow-md">
            <tr>
              <th className="border p-2 w-16 text-center">Semaine</th>
              <th className="border p-2 w-24 text-center">Jour</th>
              <th className="border p-2 w-24 text-center">Date</th>
              {doctors.map(doctor => (
                <th
                  key={doctor.id}
                  className="border p-2 w-20 text-center"
                  style={{ backgroundColor: doctor.color }}
                >
                  <span className="text-black font-medium">{doctor.initials}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(({ date, weekNumber }) => {
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const dateStr = formatDateForDB(date);
              const garde = gardes.find(g => g.date === dateStr);
              const isHoliday = garde?.jour_ferie || false;
              const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });

              // Créer une clé unique pour éviter les duplicatas
              const uniqueKey = `${dateStr}-${weekNumber}`;

              return (
                <tr
                  key={uniqueKey}
                  className={`${isWeekend || isHoliday ? 'bg-gray-100' : 'bg-white'} hover:bg-gray-50 h-10`}
                >
                  <td className="border p-2 text-center">S{weekNumber}</td>
                  <td className="border p-2 capitalize text-center">{dayName}</td>
                  <td className="border p-2 text-center">
                    {date.toLocaleDateString('fr-FR')}
                    {isHoliday && <span className="ml-2 italic text-black">(F)</span>}
                    {garde?.noel && <span className="ml-2 text-red-600">🎄</span>}
                    {garde?.nouvel_an && <span className="ml-2 text-blue-600">🎊</span>}
                  </td>
                  {doctors.map(doctor => {
                    const conge = conges.find(c => c.date === dateStr && c.doctor_id === doctor.id);
                    return (
                      <td
                        key={`${doctor.id}-${dateStr}`}
                        className="border p-2 text-center cursor-pointer"
                        style={{ backgroundColor: (isWeekend || isHoliday) ? '#F3F4F6' : doctor.color }}
                        onClick={() => toggleConge(dateStr, doctor.id)}
                      >
                        {conge?.is_conge ? (
                          <span className="text-black">✓</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-gray-200 z-10 shadow-md">
            <tr>
              <td colSpan={3} className="border p-2 text-center font-bold">Total</td>
              {doctors.map(doctor => (
                <td
                  key={`total-${doctor.id}`}
                  className="border p-2 text-center"
                  style={{ backgroundColor: doctor.color }}
                >
                  {getTotalConges(doctor.id)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}