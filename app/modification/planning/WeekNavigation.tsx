'use client';

import React, { useState, useEffect } from 'react';
import { getWeekNumber, getDateOfWeek, getWeeksInYear } from './utils';
import { getWeekValidation, upsertWeekValidation } from '../../../lib/supabase/client';

interface WeekNavigationProps {
  currentDate: Date;
  selectedWeek: number;
  selectedYear: number;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  setSelectedWeek: React.Dispatch<React.SetStateAction<number>>;
  setSelectedYear: React.Dispatch<React.SetStateAction<number>>;
  setExpandedCell: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string } | null>>;
  setSelectedDoctor: React.Dispatch<React.SetStateAction<{
    day: string;
    slot: string;
    machineId: string;
    doctorId: string | null;
    updateExceptionHours?: (doctorId: string, hours: number | null) => void;
  } | null>>;
  weekDays: Date[];
}

export const WeekNavigation: React.FC<WeekNavigationProps> = ({
  currentDate,
  selectedWeek,
  selectedYear,
  setCurrentDate,
  setSelectedWeek,
  setSelectedYear,
  setExpandedCell,
  setSelectedDoctor,
  weekDays
}) => {
  const [isWeekValidated, setIsWeekValidated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Charger le statut de validation de la semaine lors du changement de semaine ou d'année
  useEffect(() => {
    const fetchValidationStatus = async () => {
      setIsLoading(true);
      try {
        const isValidated = await getWeekValidation(selectedYear, selectedWeek);
        setIsWeekValidated(isValidated);
      } catch (error) {
        console.error('Erreur lors du chargement du statut de validation:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchValidationStatus();
  }, [selectedYear, selectedWeek]);

  // Gérer le clic sur le bouton de validation
  const handleToggleValidation = async () => {
    setIsLoading(true);
    try {
      const newValidationStatus = !isWeekValidated;
      await upsertWeekValidation(selectedYear, selectedWeek, newValidationStatus);
      setIsWeekValidated(newValidationStatus);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut de validation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const changeWeek = (offset: number) => {
    try {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + (offset * 7));
      if (isNaN(newDate.getTime())) {
        throw new Error('Invalid date generated in changeWeek');
      }
      const { week, year } = getWeekNumber(newDate);
      setCurrentDate(newDate);
      setSelectedWeek(week);
      setSelectedYear(year);
      setExpandedCell(null);
      setSelectedDoctor(null);
    } catch (error) {
      console.error('Erreur lors du changement de semaine:', error);
    }
  };

  const handleWeekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      const week = parseInt(e.target.value);
      if (isNaN(week) || week < 1 || week > getWeeksInYear(selectedYear)) {
        throw new Error(`Invalid week number: ${week}`);
      }
      const newDate = getDateOfWeek(week, selectedYear);
      const { year: calculatedYear } = getWeekNumber(newDate);
      setCurrentDate(newDate);
      setSelectedWeek(week);
      setSelectedYear(calculatedYear);
      setExpandedCell(null);
      setSelectedDoctor(null);
    } catch (error) {
      console.error('Erreur lors de la sélection de la semaine:', error);
    }
  };

  // Calculer le nombre de semaines pour l'année sélectionnée
  let weeksInYear = 52;
  try {
    weeksInYear = getWeeksInYear(selectedYear);
  } catch (error) {
    console.error('Erreur lors du calcul du nombre de semaines:', error);
  }

  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={() => changeWeek(-1)}
        className="p-1 bg-white border rounded hover:bg-gray-100 text-sm"
      >
        ← Précédente
      </button>
      
      <div className="flex items-center gap-2">
        <select 
          value={selectedWeek}
          onChange={handleWeekChange}
          className="p-1 border rounded text-sm"
        >
          {Array.from({ length: weeksInYear }, (_, i) => i + 1).map(week => (
            <option key={week} value={week}>
              Semaine {week}
            </option>
          ))}
        </select>
        
        <select 
          value={selectedYear}
          onChange={(e) => {
            try {
              const year = parseInt(e.target.value);
              if (isNaN(year) || year < 1970 || year > 9999) {
                throw new Error(`Invalid year: ${year}`);
              }
              const newDate = new Date(currentDate);
              newDate.setFullYear(year);
              const { week, year: calculatedYear } = getWeekNumber(newDate);
              setCurrentDate(newDate);
              setSelectedWeek(week);
              setSelectedYear(calculatedYear);
            } catch (error) {
              console.error('Erreur lors du changement d\'année:', error);
            }
          }}
          className="p-1 border rounded text-sm"
        >
          {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034].map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>
      
      <button 
        onClick={() => changeWeek(1)}
        className="p-1 bg-white border rounded hover:bg-gray-100 text-sm"
      >
        Suivante →
      </button>

      <div className="flex items-center gap-4 ml-4">
        <div className="font-medium text-sm">
          Semaine du {weekDays[0]?.toLocaleDateString('fr-FR') || 'N/A'} au {weekDays[5]?.toLocaleDateString('fr-FR') || 'N/A'}
        </div>
        <button
          onClick={handleToggleValidation}
          disabled={isLoading}
          className={`flex items-center gap-2 px-3 py-1 rounded text-sm font-medium ${
            isWeekValidated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isWeekValidated ? (
            <>
              <span className="text-green-600">✔</span>
              Semaine Validée
            </>
          ) : (
            <>
              <span className="text-red-600">✖</span>
              Semaine Non Validée
            </>
          )}
        </button>
      </div>
    </div>
  );
};