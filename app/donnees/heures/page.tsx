'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';

// Définir les types manuellement
interface Doctor {
  id: string;
  first_name: string;
  last_name: string | null;
  initials: string;
  color: string | null;
  is_active: boolean;
  type: 'associé' | 'remplaçant';
}

interface WeeklyHours {
  id?: string;
  doctor_id: string;
  year: number;
  week_number: number;
  total_hours: number | string; // Peut être string si retourné par Supabase
}

interface Week {
  id?: string;
  year: number;
  week_number: number;
  is_validated: boolean;
}
// Fonction pour déterminer le nombre de semaines dans une année
const getWeeksInYear = (year: number) => {
  const date = new Date(year, 11, 31); // 31 décembre de l'année
  const weekNumber = Math.ceil(((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
  return weekNumber;
};

export default function PlanningPage() {
  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion', 'user']);
  const [year, setYear] = useState(new Date().getFullYear());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours[]>([]);
  const [validatedWeeks, setValidatedWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Récupérer les données depuis Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      // Récupérer les médecins
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('*')
        .eq('is_active', true);

      if (doctorsError) {
        setError(doctorsError.message);
        setLoading(false);
        return;
      }

      // Récupérer les heures hebdomadaires pour l'année sélectionnée
      const { data: hoursData, error: hoursError } = await supabase
        .from('weekly_hours')
        .select('*')
        .eq('year', year);

      if (hoursError) {
        setError(hoursError.message);
        setLoading(false);
        return;
      }

      // Récupérer les semaines validées pour l'année sélectionnée
      const { data: weeksData, error: weeksError } = await supabase
        .from('weeks')
        .select('*')
        .eq('year', year)
        .eq('is_validated', true);

      if (weeksError) {
        setError(weeksError.message);
        setLoading(false);
        return;
      }

      setDoctors(doctorsData || []);
      setWeeklyHours(hoursData || []);
      setValidatedWeeks(weeksData || []);
      setLoading(false);
    };

    fetchData();
  }, [year]);

  // Vérification d'authentification APRÈS tous les hooks
  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }
  
  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  // Liste des années pour le dropdown
  const years = Array.from({ length: 11 }, (_, i) => 2025 + i);

  // Nombre de semaines pour l'année sélectionnée
  const weeks = getWeeksInYear(year);

  // Séparer les médecins associés et remplaçants
  const associes = doctors.filter((doctor) => doctor.type === 'associé');
  const remplacants = doctors.filter((doctor) => doctor.type === 'remplaçant');

  // Calculer le total des heures par médecin pour l'année (seulement semaines validées)
  const getTotalHours = (doctorId: string) => {
    return weeklyHours
      .filter((hour) => 
        hour.doctor_id === doctorId && 
        hour.year === year &&
        validatedWeeks.some((week) => week.week_number === hour.week_number && week.year === hour.year)
      )
      .reduce((sum, hour) => sum + Number(hour.total_hours), 0);
  };

  // Rendu d'un tableau
  const renderTable = (doctorsList: Doctor[], title: string) => {
    if (doctorsList.length === 0) {
      return (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">{title}</h2>
          <p>Aucun médecin {title.toLowerCase()} trouvé.</p>
        </div>
      );
    }

    return (
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <div className="overflow-x-auto relative">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border p-2 sticky left-0 bg-gray-200 z-10">Médecin</th>
                {Array.from({ length: weeks }, (_, i) => (
                  <th key={i + 1} className="border p-2 min-w-[60px]">
                    S{i + 1}
                  </th>
                ))}
                <th className="border p-2 sticky right-0 bg-gray-200 z-10">Total</th>
              </tr>
            </thead>
            <tbody>
              {doctorsList.map((doctor) => (
                <tr key={doctor.id} style={{ backgroundColor: doctor.color || '#ffffff' }}>
                  <td className="border p-2 sticky left-0 bg-inherit z-10 text-center font-bold text-black">
                    {doctor.initials || '-'}
                  </td>
                  {Array.from({ length: weeks }, (_, i) => {
                    const weekNumber = i + 1;
                    const isWeekValidated = validatedWeeks.some(
                      (week) => week.week_number === weekNumber && week.year === year
                    );
                    const weekHour = weeklyHours.find(
                      (hour) =>
                        hour.doctor_id === doctor.id &&
                        hour.week_number === weekNumber &&
                        hour.year === year
                    );
                    return (
                      <td key={i + 1} className="border p-2 text-center">
                        {weekHour && isWeekValidated ? Number(weekHour.total_hours).toFixed(1) : '-'}
                      </td>
                    );
                  })}
                  <td className="border p-2 sticky right-0 bg-inherit z-10 text-center font-bold">
                    {getTotalHours(doctor.id).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Planning Médical - Heures par Année</h1>

      {/* Sélection de l'année */}
      <div className="mb-6">
        <label htmlFor="year" className="mr-2">
          Année :
        </label>
        <select
          id="year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border rounded p-2"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Affichage des erreurs */}
      {error && <p className="text-red-500 mb-4">Erreur : {error}</p>}

      {/* Affichage du chargement */}
      {loading && <p>Chargement des données...</p>}

      {/* Tableaux */}
      {!loading && (
        <>
          {renderTable(associes, 'Médecins Associés')}
          {renderTable(remplacants, 'Médecins Remplaçants')}
        </>
      )}
    </div>
  );
}