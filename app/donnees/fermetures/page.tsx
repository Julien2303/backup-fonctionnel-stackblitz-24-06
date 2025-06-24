'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getEveningAssignmentsForYear } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';

interface Doctor {
  id: string;
  initials: string;
  color: string | null;
  type: string | null;
}

interface Assignment {
  shiftId: string;
  doctorId: string;
  differe: boolean;
  date: string;
  slot: string;
}

interface Week {
  week_number: number;
  year: number;
  is_validated: boolean;
}

interface ClosureData {
  [doctorId: string]: {
    initials: string;
    color: string | null;
    type: string | null;
    closures: { [day: string]: number };
    differeClosures: { [day: string]: number };
    totalClosures: number;
    totalDiffereClosures: number;
  };
}

const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

// Fonction pour obtenir le numéro de semaine ISO d'une date
const getISOWeek = (date: Date): number => {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  return 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

export default function ClosuresPage() {
  // TOUS les hooks doivent être appelés au début, avant tout return conditionnel
  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion', 'user']);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [closureData, setClosureData] = useState<ClosureData>({});
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [validatedWeeks, setValidatedWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);

  // Récupérer les années disponibles
  useEffect(() => {
    async function fetchYears() {
      console.log('Fetching available years...');
      const { data, error } = await supabase
        .rpc('get_distinct_shift_years')
        .select('year')
        .order('year', { ascending: false });

      if (error) {
        console.error('Erreur lors de la récupération des années:', error.message);
        const currentYear = new Date().getFullYear();
        const fallbackYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
        console.log('Fallback years:', fallbackYears);
        setYears(fallbackYears);
        return;
      }

      const uniqueYears =
        data && data.length > 0
          ? [...new Set(data.map((row) => Number(row.year)))].sort((a, b) => b - a)
          : [];

      if (uniqueYears.length === 0) {
        console.warn('Aucun shift trouvé dans la base de données. Utilisation des années par défaut.');
        const currentYear = new Date().getFullYear();
        uniqueYears.push(...Array.from({ length: 5 }, (_, i) => currentYear - i));
      }

      console.log('Années récupérées:', uniqueYears);
      setYears(uniqueYears);
      if (uniqueYears.length > 0 && !uniqueYears.includes(selectedYear)) {
        console.log('Setting selected year to:', uniqueYears[0]);
        setSelectedYear(uniqueYears[0]);
      }
    }
    fetchYears();
  }, [selectedYear]);

  // Récupérer les médecins et les assignations pour l'année sélectionnée
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      console.log('Fetching data for year:', selectedYear);

      // Récupérer les médecins
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('id, initials, color, type')
        .eq('is_active', true);

      if (doctorsError) {
        console.error('Erreur lors de la récupération des médecins:', doctorsError.message);
        setLoading(false);
        return;
      }
      console.log('Doctors fetched:', doctorsData);
      setDoctors(doctorsData);

      // Récupérer les semaines validées pour l'année sélectionnée
      const { data: weeksData, error: weeksError } = await supabase
        .from('weeks')
        .select('*')
        .eq('year', selectedYear)
        .eq('is_validated', true);

      if (weeksError) {
        console.error('Erreur lors de la récupération des semaines validées:', weeksError.message);
        setLoading(false);
        return;
      }
      console.log('Validated weeks fetched:', weeksData);
      setValidatedWeeks(weeksData || []);

      // Initialiser closureMap
      const closureMap: ClosureData = {};
      doctorsData.forEach((doctor) => {
        closureMap[doctor.id] = {
          initials: doctor.initials || '',
          color: doctor.color || '#FFFFFF',
          type: doctor.type || '',
          closures: { Lundi: 0, Mardi: 0, Mercredi: 0, Jeudi: 0, Vendredi: 0 },
          differeClosures: { Lundi: 0, Mardi: 0, Mercredi: 0, Jeudi: 0, Vendredi: 0 },
          totalClosures: 0,
          totalDiffereClosures: 0,
        };
      });
      console.log('Initialized closureMap:', closureMap);

      try {
        console.log(`Fetching evening assignments for year ${selectedYear}`);
        const assignments = await getEveningAssignmentsForYear(selectedYear);
        console.log('Evening assignments for year:', assignments);

        if (assignments.length === 0) {
          console.warn('No evening assignments found for year:', selectedYear);
          setClosureData(closureMap);
          setLoading(false);
          return;
        }

        // Regrouper les assignations par date et médecin pour éviter les doublons
        const assignmentsByDateAndDoctor: {
          [date: string]: { [doctorId: string]: { normal: boolean; differe: boolean } };
        } = {};

        assignments.forEach((assignment) => {
          if (assignment.slot !== 'Soir') {
            console.log(`Skipping assignment with slot: ${assignment.slot}`);
            return;
          }

          // Vérifier si la date est valide
          if (!assignment.date || isNaN(Date.parse(assignment.date))) {
            console.warn(`Invalid date for assignment:`, assignment);
            return;
          }

          const parsedDate = new Date(assignment.date);
          const dayOfWeek = parsedDate.getDay();
          if (dayOfWeek < 1 || dayOfWeek > 5) {
            console.log(`Skipping non-weekday assignment: date=${assignment.date}, dayOfWeek=${dayOfWeek}`);
            return;
          }

          // Vérifier si la semaine de cette date est validée
          const weekNumber = getISOWeek(parsedDate);
          const isWeekValidated = weeksData.some(
            (week) => week.week_number === weekNumber && week.year === selectedYear
          );

          if (!isWeekValidated) {
            console.log(`Skipping assignment for non-validated week: date=${assignment.date}, week=${weekNumber}`);
            return;
          }

          const dateKey = assignment.date;
          const doctorId = assignment.doctorId;
          const dayName = daysOfWeek[dayOfWeek - 1];

          if (!dayName) {
            console.warn(`Invalid dayName for date=${assignment.date}, dayOfWeek=${dayOfWeek}`);
            return;
          }

          console.log('Processing assignment:', { doctorId, date: assignment.date, dayName, differe: assignment.differe, weekNumber, validated: true });

          if (!assignmentsByDateAndDoctor[dateKey]) {
            assignmentsByDateAndDoctor[dateKey] = {};
          }
          if (!assignmentsByDateAndDoctor[dateKey][doctorId]) {
            assignmentsByDateAndDoctor[dateKey][doctorId] = { normal: false, differe: false };
          }

          // Marquer la présence du médecin pour cette date
          if (assignment.differe) {
            assignmentsByDateAndDoctor[dateKey][doctorId].differe = true;
          } else {
            assignmentsByDateAndDoctor[dateKey][doctorId].normal = true;
          }
        });

        console.log('Assignments by date and doctor (validated weeks only):', assignmentsByDateAndDoctor);

        // Compter les fermetures par jour de la semaine
        Object.entries(assignmentsByDateAndDoctor).forEach(([date, doctors]) => {
          const parsedDate = new Date(date);
          const dayOfWeek = parsedDate.getDay();
          const dayName = daysOfWeek[dayOfWeek - 1];

          if (!dayName) {
            console.warn(`Invalid dayName for date=${date} in counting loop`);
            return;
          }

          Object.entries(doctors).forEach(([doctorId, { normal, differe }]) => {
            console.log('Counting for doctor:', { doctorId, date, dayName, normal, differe });

            if (closureMap[doctorId]) {
              if (normal) {
                closureMap[doctorId].closures[dayName]++;
                closureMap[doctorId].totalClosures++;
              }
              if (differe) {
                closureMap[doctorId].differeClosures[dayName]++;
                closureMap[doctorId].totalDiffereClosures++;
              }
            } else {
              console.warn(`Doctor ${doctorId} not found in closureMap`);
            }
          });
        });

        console.log('Final closureMap:', closureMap);
        setClosureData(closureMap);
      } catch (error) {
        console.error('Erreur lors de la récupération des assignations:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedYear]);

  // Vérification d'authentification APRÈS tous les hooks
  if (authLoading) {
    return <div>Chargement...</div>;
  }

  if (authError) {
    return <div>Erreur: {authError}</div>;
  }

  // Trier les médecins : associés en premier, puis remplaçants
  const sortedDoctors = doctors.sort((a, b) => {
    if (a.type === 'associé' && b.type !== 'associé') return -1;
    if (a.type !== 'associé' && b.type === 'associé') return 1;
    return a.initials.localeCompare(b.initials);
  });

  // Filtrer les médecins ayant au moins une fermeture ou fermeture différée
  const activeDoctors = sortedDoctors.filter((doctor) => {
    const data = closureData[doctor.id];
    if (!data) return false;
    const hasClosures = Object.values(data.closures).some((count) => count > 0);
    const hasDiffereClosures = Object.values(data.differeClosures).some((count) => count > 0);
    return hasClosures || hasDiffereClosures;
  });
  console.log('Active doctors:', activeDoctors);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Tableau des Fermetures</h1>
      <p className="text-sm text-gray-600 mb-4">
        * Seules les fermetures des semaines validées sont comptabilisées
      </p>
  
      {/* Sélecteur d'année */}
      <div className="mb-4">
        <label htmlFor="year-select" className="mr-2">Année :</label>
        <select
          id="year-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="border rounded p-2"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <span className="ml-4 text-sm text-gray-600">
          Semaines validées : {validatedWeeks.length}
        </span>
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <>
          {/* Tableau des fermetures normales */}
          <h2 className="text-xl font-semibold mb-2">Fermetures normales</h2>
          <table className="w-full border-collapse mb-8">
            <thead>
              <tr className="bg-gray-200">
                <th className="border p-2">Médecin</th>
                {daysOfWeek.map((day) => (
                  <th key={day} className="border p-2">
                    {day}
                  </th>
                ))}
                <th className="border p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {activeDoctors.map((doctor) => (
                <tr
                  key={doctor.id}
                  style={{ backgroundColor: closureData[doctor.id]?.color || '#FFFFFF' }}
                >
                  <td className="border p-2">{closureData[doctor.id]?.initials}</td>
                  {daysOfWeek.map((day) => (
                    <td key={day} className="border p-2 text-center">
                      {closureData[doctor.id]?.closures[day] || 0}
                    </td>
                  ))}
                  <td className="border p-2 text-center">{closureData[doctor.id]?.totalClosures || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Tableau des fermetures différées */}
          <h2 className="text-xl font-semibold mb-2 italic">Fermetures différées</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border p-2">Médecin</th>
                {daysOfWeek.map((day) => (
                  <th key={day} className="border p-2">
                    {day}
                  </th>
                ))}
                <th className="border p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {activeDoctors.map((doctor) => (
                <tr
                  key={doctor.id}
                  style={{ backgroundColor: closureData[doctor.id]?.color || '#FFFFFF' }}
                  className="italic"
                >
                  <td className="border p-2">{closureData[doctor.id]?.initials}</td>
                  {daysOfWeek.map((day) => (
                    <td key={day} className="border p-2 text-center">
                      {closureData[doctor.id]?.differeClosures[day] || 0}
                    </td>
                  ))}
                  <td className="border p-2 text-center">
                    {closureData[doctor.id]?.totalDiffereClosures || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}