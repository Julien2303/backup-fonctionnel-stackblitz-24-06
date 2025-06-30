'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WeekNavigation } from './WeekNavigation';
import { GuardsRow } from './GuardsRow';
import { useDoctors } from './hooks/useDoctors';
import { useMachines } from './hooks/useMachines';
import { useAssignments } from './hooks/useAssignments';
import { getGardesForYear, getCongesForWeek, getValidatedWeeks } from '@/lib/supabase/client';
import { Doctor, Machine, Garde } from './types';
import { getWeekDays, formatFrenchDate, getWeekNumber, formatDateKey, getDateOfWeek } from './utils';
import { useAuth } from '@/lib/auth';

const StaticAssignmentCell: React.FC<{
  day: string;
  slot: string;
  machine: Machine;
  doctors: Doctor[];
  assignments: any[];
  conges: Record<string, string[]>;
}> = ({ day, slot, machine, doctors, assignments, conges }) => {
  const assignedDoctors = assignments.find(
    (a) => a.day === day && a.slot === slot && a.machineId === machine.id
  )?.doctors || [];

  const totalShares = assignedDoctors.reduce((sum: number, d: any) => sum + d.share, 0);
  const uniqueDoctorIds = new Set(
    assignedDoctors.map((d: any) =>
      d.doctorId || (d.maintenance ? 'MAINT' : d.noDoctor ? 'NO_DOCTOR' : '')
    )
  );
  const uniqueDoctorCount = uniqueDoctorIds.size;

  const renderDoctorInitials = (doctorAssignment: any, index: number) => {
    const widthPercentage = totalShares > 0 ? (doctorAssignment.share / totalShares) * 100 : 100;

    if (doctorAssignment.maintenance) {
      return (
        <div
          key={`MAINT-${machine.id}-${day}-${slot}-${index}`}
          className={`flex items-center justify-center h-full ${
            index < assignedDoctors.length - 1 ? 'border-r border-gray-200' : ''
          }`}
          style={{
            backgroundColor: '#d1d5db',
            width: `${widthPercentage}%`,
            marginRight: index === assignedDoctors.length - 1 ? '1px' : '0',
            marginLeft: index === 0 ? '0px' : '0',
          }}
        >
          <span className="text-sm font-medium text-gray-800">MAINT</span>
        </div>
      );
    }

    if (doctorAssignment.noDoctor) {
      return (
        <div
          key={`NO_DOCTOR-${machine.id}-${day}-${slot}-${index}`}
          className={`flex items-center justify-center h-full ${
            index < assignedDoctors.length - 1 ? 'border-r border-gray-200' : ''
          }`}
          style={{
            backgroundColor: '#d1d5db',
            width: `${widthPercentage}%`,
            marginRight: index === assignedDoctors.length - 1 ? '1px' : '0',
            marginLeft: index === 0 ? '0px' : '0',
          }}
        >
        </div>
      );
    }

    const doctor = doctors.find((d) => d.id === doctorAssignment.doctorId);
    if (!doctor) return null;

    const initialsLength = doctor.initials?.length || 0;
    let fontSizeClass = 'text-sm';
    if (widthPercentage < 25 || (initialsLength > 8 && widthPercentage < 50)) {
      fontSizeClass = 'text-[0.5rem]';
    } else if (widthPercentage < 40 || (initialsLength > 5 && widthPercentage < 60)) {
      fontSizeClass = 'text-[0.65rem]';
    } else if (initialsLength > 8) {
      fontSizeClass = 'text-xs';
    } else if (uniqueDoctorCount >= 4) {
      fontSizeClass = 'text-[0.65rem]';
    } else if (uniqueDoctorCount === 3) {
      fontSizeClass = 'text-[0.75rem]';
    } else if (uniqueDoctorCount === 2) {
      fontSizeClass = 'text-[0.875rem]';
    }

    const textClass = [
      fontSizeClass,
      'font-medium',
      doctorAssignment.teleradiologie ? 'font-bold text-green-600' : '',
      doctorAssignment.differe ? 'font-bold text-red-600' : '',
      doctorAssignment.plusDiffere ? 'underline' : '',
    ].filter(Boolean).join(' ');

    return (
      <div
        key={`doctor-${doctor.id}-${machine.id}-${day}-${slot}-${index}`}
        className={`flex items-center justify-center h-full ${
          index < assignedDoctors.length - 1 ? 'border-r border-gray-200' : ''
        }`}
        style={{
          backgroundColor: doctor.color,
          width: `${widthPercentage}%`,
          marginRight: index === assignedDoctors.length - 1 ? '1px' : '0',
          marginLeft: index === 0 ? '0px' : '0',
        }}
      >
        <span className={textClass}>{doctor.initials}</span>
      </div>
    );
  };

  return (
    <div
      className="relative w-full h-full flex flex-row"
      style={{ minWidth: '100px', height: slot === 'Soir' ? '40px' : '60px' }}
    >
      {assignedDoctors.length > 0 ? (
        assignedDoctors.map((doctorAssignment: any, index: number) =>
          renderDoctorInitials(doctorAssignment, index)
        )
      ) : (
        <div className="flex items-center justify-center h-full w-full text-gray-400">-</div>
      )}
    </div>
  );
};

export default function VisualizationPlanningPage() {
  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion', 'user']);
  const today = new Date();
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [gardes, setGardes] = useState<Garde[]>([]);
  const [conges, setConges] = useState<Record<string, string[]>>({});
  const [validatedWeeks, setValidatedWeeks] = useState<number[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { doctors, loadDoctors } = useDoctors();
  const { machines, loadMachines } = useMachines();
  const { assignments, loadAssignments, isLoadingAssignments } = useAssignments();

  const findClosestValidatedWeek = (week: number, year: number, validated: number[]): { week: number; year: number } => {
    if (validated.includes(week)) {
      return { week, year };
    }
    const sortedWeeks = validated.sort((a, b) => a - b);
    let closestWeek = sortedWeeks[0] || 1;
    let minDiff = Infinity;
    sortedWeeks.forEach((w) => {
      const diff = Math.abs(w - week);
      if (diff < minDiff) {
        minDiff = diff;
        closestWeek = w;
      }
    });
    return { week: closestWeek, year };
  };

  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        await loadDoctors();
        await loadMachines();
        const validated = await getValidatedWeeks(selectedYear);
        setValidatedWeeks(validated);

        const { week: todayWeek, year: todayYear } = getWeekNumber(today);
        const { week: closestWeek, year: closestYear } = findClosestValidatedWeek(todayWeek, todayYear, validated);
        const closestDate = getDateOfWeek(closestWeek, closestYear);

        setCurrentDate(closestDate);
        setSelectedWeek(closestWeek);
        setSelectedYear(closestYear);

        const gardesData = await getGardesForYear(closestYear);
        setGardes(gardesData);
        const congesData = await getCongesForWeek(closestYear, closestWeek);
        setConges(congesData);
      } catch (error) {
        console.error("Erreur lors de l'initialisation des données:", error);
        setError('Erreur lors du chargement du planning.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [loadDoctors, loadMachines, selectedYear]);

  useEffect(() => {
    if (machines.length > 0 && selectedWeek > 0 && currentDate && selectedYear >= 1970 && selectedYear <= 9999) {
      try {
        const weekDays = getWeekDays(currentDate);
        loadAssignments(selectedYear, selectedWeek, machines, weekDays);
      } catch (error) {
        console.error('Erreur lors du chargement des affectations:', error);
        setError('Erreur lors du chargement des affectations.');
      }
    }
  }, [machines, selectedWeek, selectedYear, loadAssignments, currentDate]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 5, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 5, 50));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') handleZoomIn();
      else if (e.key === '-' || e.key === '_') handleZoomOut();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut]);

  const renderPlanningTable = () => {
    if (error) {
      return <div className="p-4 text-red-600">{error}</div>;
    }

    if (!currentDate) {
      return <div className="p-4 text-red-600">Aucune date sélectionnée.</div>;
    }

    let weekDays: Date[] = [];
    try {
      weekDays = getWeekDays(currentDate);
    } catch (error) {
      console.error('Erreur lors de la génération des jours de la semaine:', error);
      return <div className="p-4 text-red-600">Erreur lors de la génération du planning.</div>;
    }

    if (weekDays.length === 0) {
      return <div className="p-4 text-red-600">Aucune donnée disponible pour cette semaine.</div>;
    }

    const sites = Array.from(new Set(machines.map((m) => m.site).filter((site): site is string => site !== undefined)));
    const sortedSites = sites.sort((a, b) => {
      if (a === 'CDS') return -1;
      if (b === 'CDS') return 1;
      if (a === 'ST EX') return -1;
      if (b === 'ST EX') return 1;
      return a.localeCompare(b);
    });

    const orderedMachines = sortedSites.flatMap((site) =>
      machines.filter((m) => m.site === site)
    );
    const uniqueMachinesWithoutSite = machines.filter((m) => !m.site);
    orderedMachines.push(...uniqueMachinesWithoutSite);

    const separationIndices: number[] = [];
    let currentIndex = 0;
    for (let i = 0; i < sortedSites.length; i++) {
      const machinesInSite = machines.filter((m) => m.site === sortedSites[i]);
      currentIndex += machinesInSite.length - 1;
      if (i < sortedSites.length - 1) separationIndices.push(currentIndex);
      currentIndex++;
    }
    if (sortedSites.length > 0 && uniqueMachinesWithoutSite.length > 0)
      separationIndices.push(currentIndex - 1);

    const siteSeparationIndices: number[] = [];
    let siteIndexCounter = 0;
    for (let i = 0; i < sortedSites.length; i++) {
      siteIndexCounter += machines.filter((m) => m.site === sortedSites[i]).length;
      if (i < sortedSites.length - 1) siteSeparationIndices.push(siteIndexCounter - 1);
    }
    if (sortedSites.length > 0 && uniqueMachinesWithoutSite.length > 0)
      siteSeparationIndices.push(siteIndexCounter - 1);

    const fixedColumnWidth = 'min-w-[100px] max-w-[100px] w-[120px]';

    return (
      <table className="table-fixed w-auto text-base border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th
              rowSpan={2}
              className="p-1 text-center w-32 border-r border-gray-400 border-b-2 border-gray-600"
            >
              Jour
            </th>
            <th
              rowSpan={2}
              className="p-1 text-center min-w-[6rem] whitespace-nowrap border-r-2 border-gray-600 bg-gray-100"
            >
              Vacation
            </th>
            <th
              rowSpan={2}
              className="p-1 text-center min-w-[6rem] whitespace-nowrap border-r-2 border-gray-600 bg-gray-100"
            >
              Congés
            </th>
            {sortedSites.map((site, siteIndex) => (
              <th
                key={`site-header-${site}-${siteIndex}`}
                colSpan={machines.filter((m) => m.site === site).length}
                className={`p-1 text-center border-b border-gray-400 text-sm bg-gray-100 ${
                  siteSeparationIndices.includes(siteIndex) ? 'border-r-2 border-gray-600' : 'border-r border-gray-400'
                }`}
              >
                {site}
              </th>
            ))}
            {uniqueMachinesWithoutSite.length > 0 && (
              <th
                key="no-site-header"
                colSpan={uniqueMachinesWithoutSite.length}
                className="p-1 text-center border-b border-gray-400 text-sm bg-gray-100"
              >
                {uniqueMachinesWithoutSite[0].site || 'GESTION'}
              </th>
            )}
          </tr>
          <tr className="bg-gray-100">
            {orderedMachines.map((machine, machineIndex) => (
              <th
                key={`machine-header-${machine.id}-${machineIndex}`}
                className={`p-1 text-center border-b-2 border-gray-600 text-sm ${
                  separationIndices.includes(machineIndex) ? 'border-r-2 border-gray-600' : 'border-r border-gray-400'
                } ${fixedColumnWidth}`}
              >
                <div className="font-medium">{machine.name}</div>
                {machine.description && (
                  <div className="text-xs text-gray-500">{machine.description}</div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekDays.map((day, dayIndex) => {
            if (isNaN(day.getTime())) {
              console.error('Date invalide dans weekDays:', day);
              return null;
            }
            const dayName = day
              .toLocaleDateString('fr-FR', { weekday: 'long' })
              .toLowerCase()
              .replace(/^\w/, (c) => c.toUpperCase());
            const dayDate = formatFrenchDate(day);
            const dayKey = formatDateKey(day);
            const slotsToShow = dayIndex === 5 ? ['Matin'] : ['Matin', 'Après-midi', 'Soir'];

            return (
              <React.Fragment key={`planning-day-${dayKey}-${dayIndex}`}>
                {slotsToShow.map((slot, slotIndex) => (
                  <tr
                    key={`planning-row-${dayKey}-${slot}-${slotIndex}`}
                    className={`border-t ${
                      dayIndex !== 0 && slotIndex === 0 ? 'border-t-2 border-gray-600' : 'border-gray-400'
                    } ${dayIndex === 0 && slotIndex === 0 ? 'border-t-2' : ''}`}
                  >
                    {slotIndex === 0 ? (
                      <td
                        rowSpan={slotsToShow.length}
                        className={`p-1 border-r border-gray-400 bg-gray-100 text-center align-middle w-32 ${
                          dayIndex === 0 && slotIndex === 0 ? 'border-t-2' : ''
                        }`}
                      >
                        <div className="font-medium">{dayName}</div>
                        <div className="text-xs">{dayDate}</div>
                      </td>
                    ) : null}
                    <td className="p-1 bg-gray-100 text-center border-r-2 border-gray-600 w-28">
                      {slot}
                    </td>
                    {slotIndex === 0 ? (
                      <td
                        rowSpan={slotsToShow.length}
                        className="p-1 bg-gray-100 text-center border-r-2 border-gray-600 w-28"
                      >
                        {conges[dayKey] ? conges[dayKey].join(', ') : '-'}
                      </td>
                    ) : null}
                    {orderedMachines.map((machine, machineIndex) => (
                      <td
                        key={`assignment-cell-${dayKey}-${slot}-${machine.id}-${machineIndex}`}
                        className={`p-0 border-t border-b ${
                          separationIndices.includes(machineIndex) ? 'border-r-2 border-gray-600' : 'border-r border-gray-400'
                        } ${fixedColumnWidth}`}
                        style={{ boxSizing: 'border-box' }}
                      >
                        <StaticAssignmentCell
                          day={dayKey}
                          slot={slot}
                          machine={machine}
                          doctors={doctors}
                          assignments={assignments}
                          conges={conges}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <GuardsRow
                  key={`guards-row-${dayKey}-${dayIndex}`}
                  day={day}
                  machines={machines}
                  selectedMachines={machines.map((m) => m.id)}
                  showLeaves={true}
                  garde={gardes.find((g) => g.date === dayKey)}
                  isSaturday={dayIndex === 5}
                  gardes={gardes}
                />
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }

  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  return (
    <div className="p-0 max-w-full mx-0 no-outer-margins">
      {(isLoading || isLoadingAssignments) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2 p-2 bg-gray-50 rounded-lg">
        <WeekNavigation
          currentDate={currentDate || new Date()}
          selectedWeek={selectedWeek}
          selectedYear={selectedYear}
          setCurrentDate={setCurrentDate}
          setSelectedWeek={setSelectedWeek}
          setSelectedYear={setSelectedYear}
          setValidatedWeeks={setValidatedWeeks}
          setExpandedCell={() => {}}
          setSelectedDoctor={() => {}}
          weekDays={currentDate ? getWeekDays(currentDate) : []}
          validatedWeeks={validatedWeeks}
        />
        <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= 50}
            className="bg-white hover:bg-gray-100 text-gray-800 w-6 h-6 rounded disabled:opacity-50"
          >
            -
          </button>
          <span className="text-sm">Zoom:</span>
          <span className="text-xs w-10 text-center">{zoomLevel}%</span>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= 200}
            className="bg-white hover:bg-gray-100 text-gray-800 w-6 h-6 rounded disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>
      <div className="overflow-x-auto border rounded-lg text-sm">
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top left',
            width: `${100 / (zoomLevel / 100)}%`,
            height: `${100 / (zoomLevel / 100)}%`,
          }}
        >
          {renderPlanningTable()}
        </div>
      </div>
    </div>
  );
}