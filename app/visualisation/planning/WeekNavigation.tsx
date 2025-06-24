'use client';

import React, { useState, useEffect } from 'react';
import { getWeekNumber, getDateOfWeek, getWeeksInYear } from './utils';
import { getWeekValidation, getValidatedWeeks } from '../../../lib/supabase/client';

interface WeekNavigationProps {
  currentDate: Date;
  selectedWeek: number;
  selectedYear: number;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date | null>>;
  setSelectedWeek: React.Dispatch<React.SetStateAction<number>>;
  setSelectedYear: React.Dispatch<React.SetStateAction<number>>;
  setValidatedWeeks: React.Dispatch<React.SetStateAction<number[]>>;
  setExpandedCell: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string } | null>>;
  setSelectedDoctor: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string; doctorId: string } | null>>;
  weekDays: Date[];
  validatedWeeks?: number[];
}

export const WeekNavigation: React.FC<WeekNavigationProps> = ({
  currentDate,
  selectedWeek,
  selectedYear,
  setCurrentDate,
  setSelectedWeek,
  setSelectedYear,
  setValidatedWeeks,
  setExpandedCell,
  setSelectedDoctor,
  weekDays,
  validatedWeeks = [],
}) => {
  const [isWeekValidated, setIsWeekValidated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Charger les années disponibles
  useEffect(() => {
    const fetchAvailableYears = async () => {
      setIsLoading(true);
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
      setIsLoading(false);
    };

    fetchAvailableYears();
  }, []);

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
    if (selectedYear >= 1970 && selectedYear <= 9999) {
      fetchValidationStatus();
    }
  }, [selectedYear, selectedWeek]);

  const changeWeek = (offset: number) => {
    try {
      if (validatedWeeks.length > 0) {
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
      }
    } catch (error) {
      console.error('Erreur lors du changement de semaine:', error);
    }
  };

  const handleWeekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      const week = parseInt(e.target.value);
      if (isNaN(week) || !validatedWeeks.includes(week)) {
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

  const handleYearChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    let year: number | undefined; // Allow year to be undefined
    try {
      year = parseInt(e.target.value);
      if (isNaN(year) || year < 1970 || year > 9999) {
        throw new Error(`Invalid year: ${year}`);
      }
      setIsLoading(true);
      const validated = await getValidatedWeeks(year);
      setValidatedWeeks(validated);
      const newWeek = validated.length > 0 ? validated[0] : 1;
      const newDate = getDateOfWeek(newWeek, year);
      const { year: calculatedYear } = getWeekNumber(newDate);
      setCurrentDate(newDate);
      setSelectedWeek(newWeek);
      setSelectedYear(calculatedYear);
      setExpandedCell(null);
      setSelectedDoctor(null);
    } catch (error) {
      console.error(`Erreur lors du changement d'année pour ${year ?? 'inconnue'}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const weeksInYear = selectedYear >= 1970 && selectedYear <= 9999 ? getWeeksInYear(selectedYear) : 52;

  return (
    <div className="flex items-center gap-2 relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500"></div>
        </div>
      )}
      <button
        onClick={() => changeWeek(-1)}
        disabled={validatedWeeks.length > 0 && validatedWeeks.indexOf(selectedWeek) <= 0}
        className="p-1 bg-white border rounded hover:bg-gray-100 text-sm disabled:opacity-50"
      >
        ← Précédente
      </button>
      <div className="flex items-center gap-2">
        <select
          value={selectedWeek}
          onChange={handleWeekChange}
          className="p-1 border rounded text-sm"
          disabled={validatedWeeks.length === 0 || isLoading}
        >
          {validatedWeeks.map((week) => (
            <option key={week} value={week}>
              Semaine {week}
            </option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={handleYearChange}
          className="p-1 border rounded text-sm"
          disabled={isLoading}
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={() => changeWeek(1)}
        disabled={validatedWeeks.length > 0 && validatedWeeks.indexOf(selectedWeek) >= validatedWeeks.length - 1}
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