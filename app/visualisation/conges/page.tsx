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
  id: string;
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

export default function CongesVisualisationPage() {
  // Gestion de l'authentification en premier
  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion', 'user']);
  
  // États principaux
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [conges, setConges] = useState<Conge[]>([]);
  const [gardes, setGardes] = useState<Garde[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  // Liste des mois avec leurs noms (constant, pas un état)
  const months = useMemo(() => [
    { value: 1, name: 'Janvier' },
    { value: 2, name: 'Février' },
    { value: 3, name: 'Mars' },
    { value: 4, name: 'Avril' },
    { value: 5, name: 'Mai' },
    { value: 6, name: 'Juin' },
    { value: 7, name: 'Juillet' },
    { value: 8, name: 'Août' },
    { value: 9, name: 'Septembre' },
    { value: 10, name: 'Octobre' },
    { value: 11, name: 'Novembre' },
    { value: 12, name: 'Décembre' }
  ], []);

  // Fonction pour calculer le numéro de semaine ISO (stabilisée avec useCallback)
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

  // Générer les jours de l'année pour toutes les semaines ISO (stabilisée avec useCallback)
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

  // Filtrer les jours selon les mois sélectionnés (avec useMemo pour éviter les recalculs)
  const filteredDays = useMemo(() => {
    const allDays = generateDays(selectedYear);
    if (selectedMonths.length === 0) return [];
    
    return allDays.filter(day => {
      const month = day.date.getMonth() + 1;
      return selectedMonths.includes(month);
    });
  }, [generateDays, selectedYear, selectedMonths]);

  // Fonction pour formater une date au format YYYY-MM-DD (stabilisée avec useCallback)
  const formatDateForDB = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Initialisation des mois sélectionnés
  useEffect(() => {
    if (!isInitialized && selectedMonths.length === 0) {
      setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      setIsInitialized(true);
    }
  }, [isInitialized, selectedMonths]);

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    if (authLoading) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.month-dropdown')) {
        setIsMonthDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [authLoading]);

  // Récupérer les médecins associés
  useEffect(() => {
    if (authLoading) return;

    async function fetchDoctors() {
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
    }
    fetchDoctors();
  }, [authLoading]);

  // Récupérer les congés et les gardes pour l'année sélectionnée
  useEffect(() => {
    if (authLoading) return;

    async function fetchData() {
      setLoading(true);
      const allDays = generateDays(selectedYear);
      const startDate = formatDateForDB(allDays[0].date);
      const endDate = formatDateForDB(allDays[allDays.length - 1].date);

      // Récupérer les congés
      const { data: congesData, error: congesError } = await supabase
        .from('conges')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (congesError) {
        console.error('Erreur lors de la récupération des congés:', congesError);
        setLoading(false);
        return;
      }

      // Récupérer les gardes pour les jours fériés
      const { data: gardesData, error: gardesError } = await supabase
        .from('gardes')
        .select('date, jour, jour_ferie, noel, nouvel_an')
        .gte('date', startDate)
        .lte('date', endDate);

      if (gardesError) {
        console.error('Erreur lors de la récupération des gardes:', gardesError);
        setLoading(false);
        return;
      }

      setConges(congesData || []);
      setGardes(gardesData || []);
      setLoading(false);
    }
    fetchData();
  }, [selectedYear, authLoading, generateDays, formatDateForDB]);

  // Calculer le total des congés par médecin (avec useCallback pour la stabilité)
  const getTotalConges = useCallback((doctorId: string) => {
    return conges.filter(c => 
      c.doctor_id === doctorId && 
      c.is_conge && 
      selectedMonths.includes(Number(c.date.split('-')[1]))
    ).length;
  }, [conges, selectedMonths]);

  // Générer les options d'années (avec useMemo)
  const years = useMemo(() => Array.from({ length: 10 }, (_, i) => 2025 + i), []);

  // Gérer la sélection des mois avec logique spéciale
  const handleMonthToggle = useCallback((monthValue: number) => {
    setSelectedMonths(prev => {
      if (prev.length === 12) {
        return [monthValue];
      }
      
      if (prev.includes(monthValue)) {
        return prev.filter(m => m !== monthValue);
      } else {
        return [...prev, monthValue].sort((a, b) => a - b);
      }
    });
  }, []);

  // Réinitialiser à toute l'année
  const handleSelectAllMonths = useCallback(() => {
    setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  }, []);

  // Formater l'affichage des mois sélectionnés (avec useMemo)
  const selectedMonthsText = useMemo(() => {
    if (selectedMonths.length === 0) return "Aucun mois sélectionné";
    if (selectedMonths.length === 12) return "Toute l'année (cliquez sur un mois pour filtrer)";
    if (selectedMonths.length <= 3) {
      return selectedMonths.map(m => months.find(month => month.value === m)?.name).join(", ");
    }
    return `${selectedMonths.length} mois sélectionnés`;
  }, [selectedMonths, months]);

  // Gestion des états de chargement et d'erreur
  if (authLoading || !isInitialized) {
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
      <h1 className="text-2xl font-bold mb-6">Visualisation des Congés</h1>

      {/* Filtres */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Sélection de l'année */}
          <div className="flex items-center gap-2">
            <label htmlFor="year-select" className="font-medium whitespace-nowrap">Année :</label>
            <select
              id="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Sélection des mois avec menu déroulant */}
          <div className="flex items-center gap-2 flex-1">
            <label className="font-medium whitespace-nowrap">Mois :</label>
            <div className="relative flex-1 max-w-xs month-dropdown">
              <button
                type="button"
                onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                className="w-full p-2 border border-gray-300 rounded-md bg-white text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
              >
                <span className="truncate text-sm">
                  {selectedMonthsText}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Menu déroulant */}
              {isMonthDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {/* Option "Sélectionner tout" */}
                  <div className="p-2 border-b border-gray-200 bg-gray-50">
                    <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedMonths.length === 12}
                        onChange={handleSelectAllMonths}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium">
                        Réinitialiser (toute l&apos;année)
                      </span>
                    </label>
                  </div>

                  {/* Liste des mois */}
                  <div className="p-1">
                    {months.map((month) => (
                      <label
                        key={month.value}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-2 rounded text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMonths.includes(month.value)}
                          onChange={() => handleMonthToggle(month.value)}
                          className="rounded text-blue-500 focus:ring-blue-500"
                        />
                        <span>{month.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message d'aide quand toute l'année est affichée */}
        {selectedMonths.length === 12 && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            ✅ Toute l&apos;année est affichée. Cliquez sur un mois spécifique dans le menu pour filtrer rapidement.
          </div>
        )}
        
        {/* Message d'erreur si aucun mois */}
        {selectedMonths.length === 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            ⚠️ Veuillez sélectionner au moins un mois pour afficher les congés.
          </div>
        )}
      </div>

      {/* Tableau des congés */}
      {filteredDays.length > 0 ? (
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
              {filteredDays.map(({ date, weekNumber }) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const dateStr = formatDateForDB(date);
                const garde = gardes.find(g => g.date === dateStr);
                const isHoliday = garde?.jour_ferie || false;
                const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });

                return (
                  <tr
                    key={dateStr}
                    className={`${isWeekend || isHoliday ? 'bg-gray-100' : 'bg-white'} h-10`}
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
                          key={doctor.id}
                          className="border p-2 text-center"
                          style={{ backgroundColor: (isWeekend || isHoliday) ? '#F3F4F6' : doctor.color }}
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
                    key={doctor.id}
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
      ) : (
        <div className="text-center text-gray-500 mt-8">
          {selectedMonths.length === 0 
            ? "Veuillez sélectionner au moins un mois pour afficher les congés."
            : "Aucune donnée disponible pour les mois sélectionnés."
          }
        </div>
      )}
    </div>
  );
}