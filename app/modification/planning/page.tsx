'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DoctorMenu } from './DoctorMenu';
import { WeekNavigation } from './WeekNavigation';
import { MachineFilter } from './MachineFilter';
import { AssignmentCell } from './AssignmentCell';
import { GuardsRow } from './GuardsRow';
import { useDoctors } from './hooks/useDoctors';
import { useMachines } from './hooks/useMachines';
import { useAssignments } from './hooks/useAssignments';
import { getGardesForYear, getCongesForWeek } from '@/lib/supabase/client';
import { Doctor, Machine, Garde, DoctorAssignment } from './types';
import { getWeekNumber, getWeekDays, formatFrenchDate, formatDateKey } from './utils';
import { useAuth } from '@/lib/auth';

export default function PlanningPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeekNumber(new Date()).week);
  const [selectedYear, setSelectedYear] = useState<number>(getWeekNumber(new Date()).year);
  const [expandedCell, setExpandedCell] = useState<{ day: string; slot: string; machineId: string } | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<{
    day: string;
    slot: string;
    machineId: string;
    doctorId: string | null;
    updateExceptionHours?: (doctorId: string, hours: number | null) => void;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [showGuards, setShowGuards] = useState<boolean>(true);
  const [showLeaves, setShowLeaves] = useState<boolean>(true);
  const [gardes, setGardes] = useState<Garde[]>([]);
  const [conges, setConges] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const machineFilterRef = useRef<HTMLDivElement>(null);

  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion']);

  const { doctors, loadDoctors } = useDoctors();
  const { machines, selectedMachines, loadMachines, toggleMachine, toggleSite } = useMachines();
  const { assignments, loadAssignments, handleAssignDoctor, toggleDoctorOption, decreaseDoctorShare, increaseDoctorShare, removeDoctor } = useAssignments();

  // Charger les données initiales
  useEffect(() => {
    const loadInitialData = async () => {
      if (authLoading || authError) return;
      
      try {
        await loadDoctors();
        await loadMachines();
        
        const [gardesData, congesData] = await Promise.all([
          getGardesForYear(selectedYear),
          getCongesForWeek(selectedYear, selectedWeek)
        ]);
        
        setGardes(gardesData);
        setConges(congesData);
      } catch (err) {
        console.error('Erreur lors du chargement initial:', err);
        setError('Erreur lors du chargement des données initiales.');
      }
    };

    loadInitialData();
  }, [authLoading, authError, selectedYear, selectedWeek, loadDoctors, loadMachines]);

  // Charger les affectations
  useEffect(() => {
    const fetchAssignments = async () => {
      if (authLoading || authError || machines.length === 0) return;
      
      setIsLoading(true);
      try {
        const weekDays = getWeekDays(currentDate);
        await loadAssignments(selectedYear, selectedWeek, machines.filter(m => selectedMachines.includes(m.id)), weekDays);
      } catch (err) {
        console.error('Erreur lors du chargement des affectations:', err);
        setError('Erreur lors du chargement du planning.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignments();
  }, [authLoading, authError, machines, selectedMachines, selectedYear, selectedWeek, loadAssignments, currentDate]);

  // Gestion du clic en dehors du filtre des machines
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (machineFilterRef.current && !machineFilterRef.current.contains(event.target as Node)) {
        const dropdown = machineFilterRef.current.querySelector('[data-dropdown-open="true"]');
        if (dropdown) {
          const toggleButton = machineFilterRef.current.querySelector('button');
          if (toggleButton) toggleButton.click();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Gestion du zoom
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 5, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 5, 50));
  }, []);

  // Raccourcis clavier pour le zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') handleZoomIn();
      else if (e.key === '-' || e.key === '_') handleZoomOut();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut]);

  // Générer les jours de la semaine
  const weekDays = (() => {
    try {
      return getWeekDays(currentDate);
    } catch (err) {
      console.error('Erreur lors de la génération des jours:', err);
      setError('Erreur lors de la génération du planning.');
      return [];
    }
  })();

  const timeSlots = ['Matin', 'Après-midi', 'Soir'];

  // Rendu du tableau de planning
  const renderPlanningTable = () => {
    if (error) {
      return <div className="p-4 text-red-600">{error}</div>;
    }

    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-lg">Chargement des vacations...</span>
        </div>
      );
    }

    if (weekDays.length === 0) {
      return <div className="p-4 text-red-600">Impossible de générer le planning : dates invalides.</div>;
    }

    const sites = Array.from(
      new Set(
        selectedMachines
          .map(id => machines.find(m => m.id === id)?.site)
          .filter((site): site is string => typeof site === 'string')
      )
    );
    const sortedSites = sites.sort((a, b) => {
      if (a === 'CDS') return -1;
      if (b === 'CDS') return 1;
      if (a === 'ST EX') return -1;
      if (b === 'ST EX') return 1;
      return a.localeCompare(b);
    });

    const orderedMachines = sortedSites.flatMap(site => machines.filter(m => m.site === site && selectedMachines.includes(m.id)));
    const uniqueMachinesWithoutSite = Array.from(new Map(machines.filter(m => !m.site && selectedMachines.includes(m.id)).map(m => [m.id, m])).values());
    orderedMachines.push(...uniqueMachinesWithoutSite);

    const separationIndices: number[] = [];
    let currentIndex = 0;
    for (let i = 0; i < sortedSites.length; i++) {
      const machinesInSite = machines.filter(m => m.site === sortedSites[i] && selectedMachines.includes(m.id));
      currentIndex += machinesInSite.length - 1;
      if (i < sortedSites.length - 1) separationIndices.push(currentIndex);
      currentIndex++;
    }
    if (sortedSites.length > 0 && uniqueMachinesWithoutSite.length > 0) separationIndices.push(currentIndex - 1);

    const siteSeparationIndices: number[] = [];
    let siteIndexCounter = 0;
    for (let i = 0; i < sortedSites.length; i++) {
      siteIndexCounter += machines.filter(m => m.site === sortedSites[i] && selectedMachines.includes(m.id)).length;
      if (i < sortedSites.length - 1) siteSeparationIndices.push(siteIndexCounter - 1);
    }
    if (sortedSites.length > 0 && uniqueMachinesWithoutSite.length > 0) siteSeparationIndices.push(siteIndexCounter - 1);

    const fixedColumnWidth = 'min-w-[100px] max-w-[100px] w-[120px]';

    return (
      <table className="table-fixed w-auto text-base">
        <thead>
          <tr className="bg-gray-100">
            <th rowSpan={2} className="p-1 text-center w-32 border-r border-gray-400 border-b-2 border-gray-600">Jour</th>
            <th rowSpan={2} className="p-1 text-center min-w-[6rem] whitespace-nowrap border-r-2 border-gray-600 bg-gray-100">Vacation</th>
            <th rowSpan={2} className={`p-1 text-center min-w-[6rem] whitespace-nowrap border-r-2 border-gray-600 bg-gray-100 ${!showLeaves ? 'hidden' : ''}`}>Congés</th>
            {sortedSites.map((site, siteIndex) => (
              <th
                key={`site-header-${site}-${siteIndex}`}
                colSpan={machines.filter(m => m.site === site && selectedMachines.includes(m.id)).length}
                className={`p-1 text-center border-b border-gray-400 text-sm bg-gray-100 ${siteSeparationIndices.includes(siteIndex + 1) ? 'border-r-2 border-gray-600' : ''}`}
              >
                {site}
              </th>
            ))}
            {uniqueMachinesWithoutSite.length > 0 && (
              <th
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
                className={`p-1 text-center border-b-2 border-gray-600 text-sm ${separationIndices.includes(machineIndex) ? 'border-r-2 border-gray-600' : ''} ${fixedColumnWidth}`}
              >
                <div className="font-medium">{machine.name}</div>
                {machine.description && <div className="text-xs text-gray-500">{machine.description}</div>}
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
            const dayName = day.toLocaleDateString('fr-FR', { weekday: 'long' }).charAt(0).toUpperCase() + day.toLocaleDateString('fr-FR', { weekday: 'long' }).slice(1);
            const dayDate = formatFrenchDate(day);
            const dayKey = formatDateKey(day);
            const slotsToShow = dayIndex === 5 ? ['Matin'] : timeSlots;
            return (
              <React.Fragment key={`planning-day-${day.toString()}-${dayIndex}`}>
                {slotsToShow.map((slot, slotIndex) => (
                  <tr
                  key={`planning-row-${day.toString()}-${slot}-${slotIndex}`}
                    className={`border-t ${dayIndex !== 0 && slotIndex === 0 ? 'border-t-2 border-gray-600' : 'border-gray-400'} ${dayIndex === 0 && slotIndex === 0 ? 'border-t-2' : ''}`}
                  >
                    {slotIndex === 0 ? (
                      <td
                        rowSpan={slotsToShow.length}
                        className={`p-1 border-r border-gray-400 bg-gray-100 text-center align-middle w-32 ${dayIndex === 0 && slotIndex === 0 ? 'border-t-2' : ''}`}
                      >
                        <div className="font-medium">{dayName}</div>
                        <div className="text-xs">{dayDate}</div>
                      </td>
                    ) : null}
                    <td className={`p-1 bg-gray-100 text-center border-r-2 border-gray-600 w-28`}>{slot}</td>
                    {slotIndex === 0 ? (
                      <td
                        rowSpan={slotsToShow.length}
                        className={`p-1 bg-gray-100 text-center border-r-2 border-gray-600 w-28 ${!showLeaves ? 'hidden' : ''}`}
                      >
                        {conges[dayKey] ? conges[dayKey].join(', ') : '-'}
                      </td>
                    ) : null}
                    {orderedMachines.map((machine, machineIndex) => (
                      <td
                      key={`assignment-cell-${dayKey}-${slot}-${machine.id}-${machineIndex}`}
                        className={`p-0 ${separationIndices.includes(machineIndex) ? 'border-r-2 border-gray-600' : ''} ${fixedColumnWidth}`}
                      >
                        <AssignmentCell
                          day={dayKey}
                          slot={slot}
                          machine={machine}
                          doctors={doctors}
                          assignments={assignments}
                          expandedCell={expandedCell}
                          setExpandedCell={setExpandedCell}
                          setSelectedDoctor={setSelectedDoctor}
                          handleAssignDoctor={handleAssignDoctor}
                          decreaseDoctorShare={decreaseDoctorShare}
                          conges={conges}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                {showGuards && (
                  <GuardsRow
                    day={day}
                    machines={machines}
                    selectedMachines={selectedMachines}
                    showLeaves={showLeaves}
                    garde={gardes.find(g => g.date === formatDateKey(day))}
                    isSaturday={dayIndex === 5}
                    gardes={gardes}
                  />
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  // Les retours conditionnels doivent venir APRÈS tous les hooks
  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }

  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  return (
    <div className="p-0 max-w-full mx-0 no-outer-margins">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2 p-2 bg-gray-50 rounded-lg">
        <WeekNavigation
          currentDate={currentDate}
          selectedWeek={selectedWeek}
          selectedYear={selectedYear}
          setCurrentDate={setCurrentDate}
          setSelectedWeek={setSelectedWeek}
          setSelectedYear={setSelectedYear}
          setExpandedCell={setExpandedCell}
          setSelectedDoctor={setSelectedDoctor}
          weekDays={weekDays}
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showLeaves}
                onChange={() => setShowLeaves(prev => !prev)}
                className="form-checkbox h-5 w-5 text-blue-600"
              />
              <span className="text-sm">Congés</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showGuards}
                onChange={() => setShowGuards(prev => !prev)}
                className="form-checkbox h-5 w-5 text-blue-600"
              />
              <span className="text-sm">Gardes</span>
            </label>
          </div>
          <div ref={machineFilterRef}>
            <MachineFilter
              machines={machines}
              selectedMachines={selectedMachines}
              toggleMachine={toggleMachine}
              toggleSite={toggleSite}
            />
          </div>
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
      </div>
      <div className="overflow-x-auto border rounded-lg text-sm">
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top left',
            width: `${100 / (zoomLevel / 100)}%`,
            height: `${100 / (zoomLevel / 100)}%`
          }}
        >
          {renderPlanningTable()}
        </div>
      </div>
      {selectedDoctor && (() => {
        const currentAssignment = assignments.find(a => 
          a.day === selectedDoctor.day && 
          a.slot === selectedDoctor.slot && 
          a.machineId === selectedDoctor.machineId
        );
        
        const doctorAssignment = currentAssignment?.doctors.find(d => 
          d.doctorId === selectedDoctor.doctorId
        );

        const normalizeShiftType = (slot: string): string => {
          switch (slot) {
            case 'Matin':
              return 'matin';
            case 'Après-midi':
              return 'apres-midi';
            case 'Soir':
              return 'soir';
            default:
              return slot.toLowerCase();
          }
        };

        return (
          <DoctorMenu
            doctor={doctors.find(d => d.id === selectedDoctor.doctorId)}
            assignment={doctorAssignment!}
            shiftId={currentAssignment?.id}
            shiftDate={selectedDoctor.day}
            shiftType={normalizeShiftType(selectedDoctor.slot)}
            machineId={selectedDoctor.machineId}
            onToggleOption={(option) => toggleDoctorOption({ ...selectedDoctor, option })}
            onDecreaseShare={() => decreaseDoctorShare(selectedDoctor)}
            onIncreaseShare={() => increaseDoctorShare(selectedDoctor)}
            onRemove={() => removeDoctor(selectedDoctor)}
            onClose={() => setSelectedDoctor(null)}
            totalShares={currentAssignment?.doctors.reduce((sum, d) => sum + d.share, 0) || 0}
            onUpdateException={selectedDoctor.updateExceptionHours}
          />
        );
      })()}
    </div>
  );
}