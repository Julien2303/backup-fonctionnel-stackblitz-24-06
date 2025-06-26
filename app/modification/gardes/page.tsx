"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { removeGardeAssignment } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';

interface Doctor {
  id: string;
  initials: string;
  color: string;
  first_name: string;
  last_name: string;
}

interface Garde {
  id?: string;
  date: string;
  jour: string;
  jour_ferie: boolean;
  medecin_cds_id?: string;
  medecin_st_ex_id?: string;
  noel: boolean;
  nouvel_an: boolean;
}

interface Assignment {
  date: string;
  clinic: string;
  doctorId: string;
  doctorInitials: string;
  doctorColor: string;
}

export default function GardesPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [gardes, setGardes] = useState<Garde[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ date: string; clinic: string } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion']);

  // Fonction pour calculer le numéro de semaine ISO (stable avec useCallback)
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

  // Générer les jours de l'année pour toutes les semaines ISO (stable avec useCallback)
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

  // Utiliser useMemo pour les jours au lieu de les recalculer à chaque rendu
  const days = useMemo(() => generateDays(selectedYear), [generateDays, selectedYear]);

  // Fonction pour formater une date au format YYYY-MM-DD sans décalage de fuseau horaire
  const formatDateForDB = useCallback((date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Fonction pour vérifier si c'est Noël ou Nouvel An
  const checkSpecialDays = useCallback((date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return {
      noel: month === 12 && day === 25,
      nouvel_an: month === 1 && day === 1
    };
  }, []);

  // Récupérer les médecins associés
  useEffect(() => {
    async function fetchDoctors() {
      if (authLoading || authError) return;
      
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
  }, [authLoading, authError]);

  // Récupérer les gardes pour l'année sélectionnée - FIXÉ : supprimer generateDays des dépendances
  useEffect(() => {
    async function fetchGardes() {
      if (authLoading || authError) return;
      
      setLoading(true);
      // Calculer la plage de dates en fonction des jours générés
      const startDate = formatDateForDB(days[0].date);
      const endDate = formatDateForDB(days[days.length - 1].date);

      console.log('Fetching gardes for range:', { startDate, endDate });

      const { data, error } = await supabase
        .from('gardes')
        .select(`
          *,
          medecin_cds:medecin_cds_id(id, initials, color),
          medecin_st_ex:medecin_st_ex_id(id, initials, color)
        `)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        console.error('Erreur lors de la récupération des gardes:', error);
        setLoading(false);
        return;
      }

      console.log('Fetched gardes:', data);
      setGardes(data || []);
      setLoading(false);
    }

    // Ne s'exécuter que si on a des jours à traiter
    if (days.length > 0) {
      fetchGardes();
    }
  }, [selectedYear, authLoading, authError, days, formatDateForDB]); // Garder days mais pas generateDays

  // Créer ou mettre à jour une garde
  const upsertGarde = useCallback(async (garde: Garde) => {
    const { data, error } = await supabase
      .from('gardes')
      .upsert(garde, { onConflict: 'date' })
      .select(`
        *,
        medecin_cds:medecin_cds_id(id, initials, color),
        medecin_st_ex:medecin_st_ex_id(id, initials, color)
      `)
      .single();

    if (error) {
      console.error('Erreur lors de la mise à jour de la garde:', error);
      return null;
    }

    return data;
  }, []);

  // Gérer le clic pour basculer l'état d'un jour férié
  const toggleHoliday = useCallback(async (dateStr: string) => {
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
    const specialDays = checkSpecialDays(date);
    
    const existingGarde = gardes.find(g => g.date === dateStr);
    const newGarde: Garde = {
      date: dateStr,
      jour: dayName,
      jour_ferie: existingGarde ? !existingGarde.jour_ferie : true,
      noel: specialDays.noel,
      nouvel_an: specialDays.nouvel_an,
      medecin_cds_id: existingGarde?.medecin_cds_id || undefined,
      medecin_st_ex_id: existingGarde?.medecin_st_ex_id || undefined
    };
  
    console.log('Toggling holiday for:', { dateStr, newGarde });
  
    const updatedGarde = await upsertGarde(newGarde);
    if (updatedGarde) {
      setGardes(prev => {
        const index = prev.findIndex(g => g.date === dateStr);
        if (index >= 0) {
          const newGardes = [...prev];
          newGardes[index] = updatedGarde;
          return newGardes;
        }
        return [...prev, updatedGarde];
      });
    } else {
      if (existingGarde && !newGarde.jour_ferie && !newGarde.medecin_cds_id && !newGarde.medecin_st_ex_id && !newGarde.noel && !newGarde.nouvel_an) {
        const { error: deleteError } = await supabase
          .from('gardes')
          .delete()
          .eq('date', dateStr);
        if (deleteError) {
          console.error('Erreur lors de la suppression de la garde:', deleteError);
          return;
        }
        setGardes(prev => prev.filter(g => g.date !== dateStr));
      }
    }
  }, [gardes, checkSpecialDays, upsertGarde]);

  // Gérer le clic gauche sur une cellule pour ouvrir le menu contextuel
  const handleCellClick = useCallback((e: React.MouseEvent, dateStr: string, clinic: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuHeight = (doctors.length + 1) * 40 + 60;
    const existingGarde = gardes.find(g => g.date === dateStr);
    const hasAssignment = clinic === 'CDS' ? existingGarde?.medecin_cds_id : existingGarde?.medecin_st_ex_id;
    const actualMenuHeight = hasAssignment ? menuHeight + 40 : menuHeight;
    
    const spaceBelow = window.innerHeight - e.clientY;
    const spaceAbove = e.clientY;
    
    let yPosition = e.clientY;
    
    if (spaceBelow < actualMenuHeight && spaceAbove >= actualMenuHeight) {
      yPosition = e.clientY - actualMenuHeight;
    } else if (spaceBelow < actualMenuHeight && spaceAbove < actualMenuHeight) {
      yPosition = Math.max(10, window.innerHeight - actualMenuHeight - 10);
    }
    
    setSelectedCell({ date: dateStr, clinic });
    setContextMenuPosition({ x: e.clientX, y: yPosition });
  }, [doctors.length, gardes]);

  // Gérer la sélection d'un médecin
  const handleDoctorSelect = useCallback(async (doctor: Doctor) => {
    if (!selectedCell) return;

    const date = new Date(selectedCell.date);
    const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
    const specialDays = checkSpecialDays(date);
    
    const existingGarde = gardes.find(g => g.date === selectedCell.date);
    const newGarde: Garde = {
      date: selectedCell.date,
      jour: dayName,
      jour_ferie: existingGarde?.jour_ferie || false,
      noel: specialDays.noel,
      nouvel_an: specialDays.nouvel_an,
      [selectedCell.clinic === 'CDS' ? 'medecin_cds_id' : 'medecin_st_ex_id']: doctor.id
    };

    const updatedGarde = await upsertGarde(newGarde);
    if (updatedGarde) {
      setGardes(prev => {
        const index = prev.findIndex(g => g.date === selectedCell.date);
        if (index >= 0) {
          const newGardes = [...prev];
          newGardes[index] = updatedGarde;
          return newGardes;
        }
        return [...prev, updatedGarde];
      });
    }

    setContextMenuPosition(null);
    setSelectedCell(null);
  }, [selectedCell, checkSpecialDays, gardes, upsertGarde]);

  // Gérer la suppression d'une affectation
  const handleDeleteAssignment = useCallback(async () => {
    if (!selectedCell) return;

    console.log('Deleting assignment for:', selectedCell);

    const updatedGarde = await removeGardeAssignment(selectedCell.date, selectedCell.clinic as 'CDS' | 'ST EX');
    console.log('Updated garde after deletion:', updatedGarde);

    setGardes(prev => {
      const index = prev.findIndex(g => g.date === selectedCell.date);
      if (index >= 0) {
        if (!updatedGarde) {
          console.log('Garde removed from state:', selectedCell.date);
          return prev.filter(g => g.date !== selectedCell.date);
        }
        console.log('Updating garde in state:', updatedGarde);
        const newGardes = [...prev];
        newGardes[index] = {
          ...updatedGarde,
          medecin_cds: updatedGarde.medecin_cds || null,
          medecin_st_ex: updatedGarde.medecin_st_ex || null
        };
        return newGardes;
      }
      return prev;
    });

    setContextMenuPosition(null);
    setSelectedCell(null);
  }, [selectedCell]);

  // Fermer le menu contextuel si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('td.cursor-pointer') || target.closest('.context-menu')) {
        return;
      }
      setContextMenuPosition(null);
      setSelectedCell(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Obtenir les informations d'affectation pour une date et clinique
  const getAssignmentInfo = useCallback((dateStr: string, clinic: string) => {
    const garde = gardes.find(g => g.date === dateStr);
    if (!garde) return null;

    const doctorId = clinic === 'CDS' ? garde.medecin_cds_id : garde.medecin_st_ex_id;
    if (!doctorId) return null;

    const doctor = doctors.find(d => d.id === doctorId);
    return doctor ? {
      initials: doctor.initials,
      color: doctor.color
    } : null;
  }, [gardes, doctors]);

  // Générer les options d'années
  const years = useMemo(() => Array.from({ length: 10 }, (_, i) => 2025 + i), []);

  // Les retours conditionnels doivent venir APRÈS tous les hooks
  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }

  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  if (loading) {
    return <div className="p-4 text-center">Chargement des gardes...</div>;
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Gestion des Gardes</h1>

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

      {/* Tableau des gardes */}
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-200 z-10 shadow-md">
            <tr>
              <th className="border p-2 w-16 text-center">Semaine</th>
              <th className="border p-2 w-24 text-center">Jour</th>
              <th className="border p-2 w-24 text-center">Date</th>
              <th className="border p-2 w-64 text-center">CDS</th>
              <th className="border p-2 w-64 text-center">ST EX</th>
            </tr>
          </thead>
          <tbody>
            {days.map(({ date, weekNumber }) => {
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const dateStr = formatDateForDB(date);
              const garde = gardes.find(g => g.date === dateStr);
              const isHoliday = garde?.jour_ferie || false;
              const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });

              const cdsAssignment = getAssignmentInfo(dateStr, 'CDS');
              const stExAssignment = getAssignmentInfo(dateStr, 'ST EX');

              return (
                <tr
                  key={dateStr}
                  className={`${isWeekend || isHoliday ? 'bg-gray-100' : 'bg-white'} hover:bg-gray-50 h-10`}
                >
                  <td className="border p-2 text-center">S{weekNumber}</td>
                  <td className="border p-2 capitalize text-center">{dayName}</td>
                  <td
                    className="border p-2 cursor-pointer text-center"
                    onClick={() => toggleHoliday(dateStr)}
                  >
                    {date.toLocaleDateString('fr-FR')}
                    {isHoliday && <span className="ml-2 italic text-black">(F)</span>}
                    {garde?.noel && <span className="ml-2 text-red-600">🎄</span>}
                    {garde?.nouvel_an && <span className="ml-2 text-blue-600">🎊</span>}
                  </td>
                  <td
                    className="border p-2 relative text-center cursor-pointer"
                    onClick={(e) => handleCellClick(e, dateStr, 'CDS')}
                    style={{
                      backgroundColor: cdsAssignment?.color || 'transparent',
                    }}
                  >
                    <span 
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"
                      style={{ display: cdsAssignment ? 'none' : 'block' }}
                    >
                      +
                    </span>
                    {cdsAssignment && (
                      <span className="text-center text-black font-medium">
                        {cdsAssignment.initials}
                      </span>
                    )}
                  </td>
                  <td
                    className="border p-2 relative text-center cursor-pointer"
                    onClick={(e) => handleCellClick(e, dateStr, 'ST EX')}
                    style={{
                      backgroundColor: stExAssignment?.color || 'transparent',
                    }}
                  >
                    <span 
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"
                      style={{ display: stExAssignment ? 'none' : 'block' }}
                    >
                      +
                    </span>
                    {stExAssignment && (
                      <span className="text-center text-black font-medium">
                        {stExAssignment.initials}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Menu contextuel pour sélectionner un médecin */}
      {contextMenuPosition && (
        <div
          className="fixed bg-white border shadow-lg p-2 rounded z-50 context-menu"
          style={{
            top: contextMenuPosition.y,
            left: Math.min(contextMenuPosition.x, window.innerWidth - 200),
          }}
        >
          <h3 className="font-bold mb-2 text-center">Sélectionner un médecin</h3>
          {doctors.length > 0 ? (
            <>
              {doctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="p-2 hover:bg-gray-100 cursor-pointer text-center"
                  style={{ backgroundColor: doctor.color, color: '#000' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDoctorSelect(doctor);
                  }}
                >
                  {doctor.initials}
                </div>
              ))}
              {selectedCell && getAssignmentInfo(selectedCell.date, selectedCell.clinic) && (
                <div
                  className="p-2 mt-2 bg-red-100 hover:bg-red-200 cursor-pointer text-center text-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAssignment();
                  }}
                >
                  Supprimer
                </div>
              )}
            </>
          ) : (
            <div className="p-2 text-center text-gray-500">Aucun médecin disponible</div>
          )}
        </div>
      )}
    </div>
  );
}