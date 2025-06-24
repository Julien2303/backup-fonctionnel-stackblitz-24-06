'use client';

import React, { useState, useEffect } from 'react';
import { getWeekNumber, getDateOfWeek, getWeeksInYear } from './utils';
import { getWeekValidation, getValidatedWeeks } from '@/lib/supabase/client';

interface WeekNavigationProps {
  currentDate: Date;
  selectedWeek: number;
  selectedYear: number;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  setSelectedWeek: React.Dispatch<React.SetStateAction<number>>;
  setSelectedYear: React.Dispatch<React.SetStateAction<number>>;
  setExpandedCell: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string } | null>>;
  setSelectedDoctor: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string; doctorId: string } | null>>;
  weekDays: Date[];
  validatedWeeks: number[];
  setValidatedWeeks: React.Dispatch<React.SetStateAction<number[]>>;
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
  weekDays,
  validatedWeeks = [], // Initialisation par défaut avec un tableau vide
  setValidatedWeeks,
}) => {
  const [isWeekValidated, setIsWeekValidated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Charger les années disponibles avec des semaines validées
  useEffect(() => {
    const fetchAvailableYears = async () => {
      const startYear = 2020;
      const endYear = 2030;
      const yearsToCheck = Array.from(
        { length: endYear - startYear + 1 },
        (_, i) => startYear + i
      );
      const yearsWithValidatedWeeks: number[] = [];
      for (const year of yearsToCheck) {
        try {
          const validated = await getValidatedWeeks(year);
          if (validated.length > 0) {
            yearsWithValidatedWeeks.push(year);
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération des semaines validées pour ${year}:`, error);
        }
      }
      setAvailableYears(yearsWithValidatedWeeks.length > 0 ? yearsWithValidatedWeeks : [new Date().getFullYear()]);
    };

    fetchAvailableYears();
  }, []);

  // Charger les semaines validées pour l’année sélectionnée
  useEffect(() => {
    const fetchValidatedWeeks = async () => {
      try {
        const validated = await getValidatedWeeks(selectedYear);
        setValidatedWeeks(validated || []); // Assurer qu'on initialise avec un tableau vide si null/undefined
      } catch (error) {
        console.error(`Erreur lors de la récupération des semaines validées pour ${selectedYear}:`, error);
        setValidatedWeeks([]);
      }
    };
    fetchValidatedWeeks();
  }, [selectedYear, setValidatedWeeks]);

  // Charger le statut de validation de la semaine
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
    if (selectedYear >= 1970 && selectedYear <= 9999 && validatedWeeks.includes(selectedWeek)) {
      fetchValidationStatus();
    }
  }, [selectedYear, selectedWeek, validatedWeeks]);

  const changeWeek = (offset: number) => {
    try {
      const currentIndex = validatedWeeks.indexOf(selectedWeek);
      const newIndex = currentIndex + offset;
      if (newIndex >= 0 && newIndex < validatedWeeks.length) {
        const newWeek = validatedWeeks[newIndex];
        const newDate = getDateOfWeek(newWeek, selectedYear);
        const { year: calculatedYear } = getWeekNumber(newDate);
        setCurrentDate(newDate);
        setSelectedWeek(newWeek);
        setSelectedYear(calculatedYear);
        setExpandedCell(null);
        setSelectedDoctor(null);
      }
    } catch (error) {
      console.error('Erreur lors du changement de semaine:', error);
    }
  };

  const handleWeekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      const week = parseInt(e.target.value);
      if (!validatedWeeks.includes(week)) {
        throw new Error(`Semaine non validée: ${week}`);
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

  const handleYearChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      const year = parseInt(e.target.value);
      const validated = await getValidatedWeeks(year);
      setValidatedWeeks(validated || []);
      const newWeek = validated.length > 0 ? validated[0] : 1;
      const newDate = getDateOfWeek(newWeek, year);
      const { year: calculatedYear } = getWeekNumber(newDate);
      setCurrentDate(newDate);
      setSelectedWeek(newWeek);
      setSelectedYear(calculatedYear);
      setExpandedCell(null);
      setSelectedDoctor(null);
    } catch (error) {
      console.error('Erreur lors du changement d\'année:', error);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => changeWeek(-1)}
        disabled={validatedWeeks.length === 0 || validatedWeeks.indexOf(selectedWeek) === 0}
        className="p-1 bg-white border rounded hover:bg-gray-100 text-sm disabled:opacity-50"
      >
        ← Précédente
      </button>
      <div className="flex items-center gap-2">
        <select
          value={selectedWeek}
          onChange={handleWeekChange}
          className="p-1 border rounded text-sm"
          disabled={validatedWeeks.length === 0}
        >
          {validatedWeeks.map(week => (
            <option key={week} value={week}>
              Semaine {week}
            </option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={handleYearChange}
          className="p-1 border rounded text-sm"
        >
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>
      <button
        onClick={() => changeWeek(1)}
        disabled={validatedWeeks.length === 0 || validatedWeeks.indexOf(selectedWeek) === validatedWeeks.length - 1}
        className="p-1 bg-white border rounded hover:bg-gray-100 text-sm disabled:opacity-50"
      >
        Suivante →
      </button>
      <div className="flex items-center gap-4 ml-4">
        <div className="font-medium text-sm">
          Semaine du {weekDays[0]?.toLocaleDateString('fr-FR') || 'N/A'} au{' '}
          {weekDays[5]?.toLocaleDateString('fr-FR') || 'N/A'}
        </div>
        <button
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