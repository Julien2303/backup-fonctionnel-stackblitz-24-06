'use client';

import React, { useState, useEffect } from 'react';
import { getWeekDays, getWeeksInYear, getDateOfWeek, getWeekNumber, formatDateKey, getDayName } from './utils';
import { useAuth } from '@/lib/auth';
import { Machine } from './types';
import {
  getOrCreateWeekId,
  createShift,
  upsertDoctorAssignment,
  deleteDoctorAssignment,
  getAssignmentsForWeek,
  getMaintenancesForYear,
  supabase,
  upsertTypicalWeekAssignment,
  deleteTypicalWeekAssignment,
  getTypicalWeekAssignments,
  deleteAllTypicalWeekAssignments,
} from '@/lib/supabase/client';

interface NoDoctorAssignment {
  id: string;
  shift_id: string;
  day: string;
  slot: string;
  machineId: string;
  no_doctor: boolean;
}

interface Maintenance {
  id: string;
  shift_id: string;
  date: string;
  slot: string;
  machineId: string;
  maintenance: boolean;
}

export default function TypicalWeekPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [weekType, setWeekType] = useState<'even' | 'odd'>('even');
  const [noDoctorAssignments, setNoDoctorAssignments] = useState<NoDoctorAssignment[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<{ matin: boolean; apresMidi: boolean; soir: boolean }>({
    matin: false,
    apresMidi: false,
    soir: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion']);

  const weekDays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const timeSlots = ['Matin', 'Après-midi', 'Soir'];

  // Charger les machines et les assignations
  useEffect(() => {
    const loadData = async () => {
      if (authLoading || authError) return;

      try {
        // Charger les machines
        const { data: machinesData, error: machinesError } = await supabase.from('machines').select('*');
        if (machinesError) throw machinesError;
        setMachines(machinesData || []);

        // Charger les assignations
        const assignments = await getTypicalWeekAssignments(selectedYear, weekType);
        const noDoctor = assignments.map((a: any) => ({
          id: a.id,
          shift_id: a.id,
          day: a.day,
          slot: a.slot,
          machineId: a.machine_id,
          no_doctor: true,
        }));

        // Charger les maintenances
        const maintenance = await getMaintenancesForYear(selectedYear);

        setNoDoctorAssignments(noDoctor);
        setMaintenances(maintenance);
        setError(null);
      } catch (error: any) {
        console.error('Erreur lors du chargement des données:', error);
        setError(`Erreur lors du chargement des données: ${error.message}`);
      }
    };

    loadData();
  }, [selectedYear, weekType, authLoading, authError]);

  const getShiftId = async (date: string, slot: string, machineId: string, weekId: string) => {
    try {
      const normalizedSlot = slot.toLowerCase().replace('après-midi', 'apres-midi');
      const { data, error } = await supabase
        .from('shifts')
        .select('id')
        .eq('date', date)
        .eq('shift_type', normalizedSlot)
        .eq('machine_id', machineId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Erreur lors de la vérification du shift: ${error.message}`);
      }

      if (data) {
        return data.id;
      }

      return await createShift(date, normalizedSlot, machineId, weekId);
    } catch (error: any) {
      throw new Error(`Erreur lors de la récupération/création du shift: ${error.message}`);
    }
  };

  const handleCellClick = async (day: string, slot: string, machineId: string) => {
    try {
      const normalizedSlot = slot.toLowerCase().replace('après-midi', 'apres-midi');
      const displaySlot = normalizedSlot === 'apres-midi' ? 'Après-midi' : slot.charAt(0).toUpperCase() + slot.slice(1);

      const existingAssignment = noDoctorAssignments.find(
        (a) => a.day === day && a.slot === displaySlot && a.machineId === machineId
      );

      if (existingAssignment) {
        await deleteTypicalWeekAssignment(selectedYear, weekType, day, normalizedSlot, machineId);
        setNoDoctorAssignments(noDoctorAssignments.filter((a) => a.id !== existingAssignment.id));
      } else {
        const tempId = `temp-${Date.now()}`;
        const optimisticAssignment = {
          id: tempId,
          shift_id: tempId,
          day,
          slot: displaySlot,
          machineId,
          no_doctor: true,
        };
        setNoDoctorAssignments([...noDoctorAssignments, optimisticAssignment]);

        const newAssignment = await upsertTypicalWeekAssignment(selectedYear, weekType, day, normalizedSlot, machineId);
        
        setNoDoctorAssignments((prev) =>
          prev.map((a) =>
            a.id === tempId
              ? {
                  id: newAssignment.id,
                  shift_id: newAssignment.id,
                  day: newAssignment.day,
                  slot: displaySlot,
                  machineId: newAssignment.machine_id,
                  no_doctor: true,
                }
              : a
          )
        );
      }
      setError(null);
    } catch (error: any) {
      console.error('Erreur lors de la gestion de la vacation:', error);
      setError(`Erreur lors de la gestion de la vacation: ${error.message}`);
      setNoDoctorAssignments(noDoctorAssignments.filter((a) => !a.id.startsWith('temp-')));
    }
  };

  const applyToYear = async () => {
    setIsLoading(true);
    try {
      const weeks = getWeeksInYear(selectedYear);
      for (let week = 1; week <= weeks; week++) {
        const isEvenWeek = week % 2 === 0;
        if ((weekType === 'even' && isEvenWeek) || (weekType === 'odd' && !isEvenWeek)) {
          const weekId = await getOrCreateWeekId(selectedYear, week);
          const weekDates = getWeekDays(getDateOfWeek(week, selectedYear));

          const existingAssignments = await getAssignmentsForWeek(selectedYear, week);
          for (const assignment of existingAssignments) {
            const noDoctor = assignment.doctors.find((d: any) => d.noDoctor);
            if (noDoctor) {
              await deleteDoctorAssignment(assignment.id, null, false, true);
            }
          }

          for (const assignment of noDoctorAssignments) {
            const dayIndex = weekDays.indexOf(assignment.day);
            if (dayIndex === -1) continue;
            const dayDate = weekDates[dayIndex];
            const dayDateStr = formatDateKey(dayDate);
            const normalizedSlot = assignment.slot.toLowerCase().replace('après-midi', 'apres-midi');
            const shiftId = await getShiftId(dayDateStr, normalizedSlot, assignment.machineId, weekId);
            await upsertDoctorAssignment(shiftId, null, 1, false, false, false, false, true);
          }
        }
      }
      alert('Semaines types appliquées à l année avec succès.');
      setError(null);
    } catch (error: any) {
      console.error('Erreur lors de l application des semaines types:', error);
      setError(`Erreur lors de l'application des semaines types: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAllNoDoctorAssignments = async () => {
    if (confirm('Voulez-vous vraiment supprimer toutes les vacations sans médecins de l année sélectionnée ?')) {
      try {
        await deleteAllTypicalWeekAssignments(selectedYear, weekType);
        setNoDoctorAssignments([]);

        const { data: assignmentsToDelete, error: fetchError } = await supabase
          .from('shift_assignments')
          .select(`
            id,
            shift_id,
            shifts!inner(date)
          `)
          .eq('no_doctor', true)
          .gte('shifts.date', `${selectedYear}-01-01`)
          .lte('shifts.date', `${selectedYear}-12-31`);

        if (fetchError) {
          throw new Error(`Erreur lors de la récupération des assignations: ${fetchError.message}`);
        }

        if (assignmentsToDelete && assignmentsToDelete.length > 0) {
          const batchSize = 50;
          for (let i = 0; i < assignmentsToDelete.length; i += batchSize) {
            const batch = assignmentsToDelete.slice(i, i + batchSize);
            const batchIds = batch.map(assignment => assignment.id);
            
            const { error: deleteError } = await supabase
              .from('shift_assignments')
              .delete()
              .in('id', batchIds);

            if (deleteError) {
              throw new Error(`Erreur lors de la suppression du lot ${Math.floor(i/batchSize) + 1}: ${deleteError.message}`);
            }
            
            if (i + batchSize < assignmentsToDelete.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }

        alert(`Toutes les vacations sans médecins ont été supprimées avec succès pour l'année ${selectedYear}.`);
        setError(null);
      } catch (error: any) {
        console.error('Erreur lors de la suppression des assignations:', error);
        setError(`Erreur lors de la suppression des assignations: ${error.message}`);
      }
    }
  };

  const handleSlotChange = (slot: 'matin' | 'apresMidi' | 'soir') => {
    setSelectedSlots((prev) => ({
      ...prev,
      [slot]: !prev[slot],
    }));
  };

  const addMaintenance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const date = (form.elements.namedItem('date') as HTMLInputElement).value;
    const machineId = (form.elements.namedItem('machine') as HTMLSelectElement).value;

    try {
      const weekNumber = getWeekNumber(new Date(date)).week;
      const weekId = await getOrCreateWeekId(selectedYear, weekNumber);
      const slotsToAdd = [
        selectedSlots.matin && 'Matin',
        selectedSlots.apresMidi && 'Après-midi',
        selectedSlots.soir && 'Soir',
      ].filter(Boolean) as string[];

      if (slotsToAdd.length === 0) {
        throw new Error('Veuillez sélectionner au moins une vacation.');
      }

      const newMaintenances: Maintenance[] = [];
      for (const slot of slotsToAdd) {
        const shiftId = await getShiftId(date, slot, machineId, weekId);
        const { data: existing } = await supabase
          .from('shift_assignments')
          .select('id')
          .eq('shift_id', shiftId);
        if (existing && existing.length > 0) {
          await supabase.from('shift_assignments').delete().eq('shift_id', shiftId);
        }
        await upsertDoctorAssignment(shiftId, null, 1, false, false, false, true, false);
        newMaintenances.push({ id: shiftId, shift_id: shiftId, date, slot, machineId, maintenance: true });
      }

      setMaintenances([...maintenances, ...newMaintenances]);
      form.reset();
      setSelectedSlots({ matin: false, apresMidi: false, soir: false });
      setError(null);
    } catch (error: any) {
      console.error('Erreur lors de l ajout de la maintenance:', error);
      setError(`Erreur lors de l'ajout de la maintenance: ${error.message}`);
    }
  };

  const deleteMaintenanceById = async (shiftId: string) => {
    try {
      await deleteDoctorAssignment(shiftId, null, true, false);
      setMaintenances(maintenances.filter((m) => m.shift_id !== shiftId));
      setError(null);
    } catch (error: any) {
      console.error('Erreur lors de la suppression de la maintenance:', error);
      setError(`Erreur lors de la suppression de la maintenance: ${error.message}`);
    }
  };

  const renderTypicalWeekTable = () => {
    if (error) {
      return <div className="p-4 text-red-600">{error}</div>;
    }

    const sites = Array.from(new Set(machines.map((mo) => mo.site).filter(Boolean) as string[]));
    const sortedSites = sites.sort((a, b) => {
      if (a === 'CDS') return -1;
      if (b === 'CDS') return 1;
      if (a === 'ST EX') return -1;
      if (b === 'ST EX') return 1;
      return a.localeCompare(b);
    });

    const orderedMachines = sortedSites.flatMap((site) => machines.filter((mo) => mo.site === site));
    const uniqueMachinesWithoutSite = Array.from(
      new Map(machines.filter((mo) => !mo.site).map((mo) => [mo.id, mo])).values()
    );
    orderedMachines.push(...uniqueMachinesWithoutSite);

    const separationIndices: number[] = [];
    let currentIndex = 0;
    for (let i = 0; i < sortedSites.length; i++) {
      const machinesInSite = machines.filter((mo) => mo.site === sortedSites[i]);
      currentIndex += machinesInSite.length - 1;
      if (i < sortedSites.length - 1) separationIndices.push(currentIndex);
      currentIndex++;
    }
    if (sortedSites.length > 0 && uniqueMachinesWithoutSite.length > 0) separationIndices.push(currentIndex - 1);

    const fixedColumnWidth = 'min-w-[100px] max-w-[100px] w-[120px]';

    return (
      <table className="table-fixed w-auto text-base">
        <thead>
          <tr className="bg-gray-100">
            <th rowSpan={2} className="p-1 text-center w-32 border-r border-gray-400 border-b-2 border-gray-600">
              Jour
            </th>
            <th rowSpan={2} className="p-1 text-center min-w-[6rem] whitespace-nowrap border-r-2 border-gray-600 bg-gray-100">
              Vacation
            </th>
            {sortedSites.map((site, siteIndex) => (
              <th
                key={site}
                colSpan={machines.filter((mo) => mo.site === site).length}
                className={`p-1 text-center border-b border-gray-400 text-sm bg-gray-100 ${
                  separationIndices.includes(siteIndex + 1) ? 'border-r-2 border-gray-600' : ''
                }`}
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
                key={machine.id}
                className={`p-1 text-center border-b-2 border-gray-600 text-sm ${
                  separationIndices.includes(machineIndex) ? 'border-r-2 border-gray-600' : ''
                } ${fixedColumnWidth}`}
              >
                <div className="font-medium">{machine.name}</div>
                {machine.description && <div className="text-xs text-gray-500">{machine.description}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekDays.map((dayName, dayIndex) => {
            const slotsToShow = dayIndex === 5 ? ['Matin'] : timeSlots;
            return (
              <React.Fragment key={dayName}>
                {slotsToShow.map((slot, slotIndex) => (
                  <tr
                    key={`${dayName}-${slot}`}
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
                      </td>
                    ) : null}
                    <td className={`p-1 bg-gray-100 text-center border-r-2 border-gray-600 w-28`}>{slot}</td>
                    {orderedMachines.map((machine, machineIndex) => {
                      const isAssigned = noDoctorAssignments.some(
                        (a) => a.day === dayName && a.slot.toLowerCase() === slot.toLowerCase() && a.machineId === machine.id
                      );
                      return (
                        <td
                          key={`${dayName}-${slot}-${machine.id}`}
                          className={`p-0 ${separationIndices.includes(machineIndex) ? 'border-r-2 border-gray-600' : ''} ${fixedColumnWidth}`}
                          onClick={() => handleCellClick(dayName, slot, machine.id)}
                        >
                          <div
                            className={`w-full h-full flex items-center justify-center ${
                              isAssigned ? 'bg-gray-300' : 'bg-white'
                            } hover:bg-gray-200 cursor-pointer`}
                            style={{ height: slot === 'Soir' ? '40px' : '60px' }}
                          >
                            {isAssigned ? '' : '+'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderMaintenanceTable = () => {
    const sortedMaintenances = [...maintenances].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return (
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Gestion des Maintenances</h2>
        <form onSubmit={addMaintenance} className="flex gap-4 mb-4 items-center">
          <input type="date" name="date" required className="p-2 border rounded text-sm" />
          <select name="machine" required className="p-2 border rounded text-sm">
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.name} ({machine.site || 'GESTION'})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={selectedSlots.matin}
                onChange={() => handleSlotChange('matin')}
                className="form-checkbox"
              />
              <span className="text-sm">Matin</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={selectedSlots.apresMidi}
                onChange={() => handleSlotChange('apresMidi')}
                className="form-checkbox"
              />
              <span className="text-sm">Après-midi</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={selectedSlots.soir}
                onChange={() => handleSlotChange('soir')}
                className="form-checkbox"
              />
              <span className="text-sm">Soir</span>
            </label>
          </div>
          <button type="submit" className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
            Ajouter
          </button>
        </form>
        <table className="table-auto w-full text-sm border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Date</th>
              <th className="p-2 border">Machine</th>
              <th className="p-2 border">Vacation</th>
              <th className="p-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedMaintenances.map((maintenance) => (
              <tr key={maintenance.shift_id}>
                <td className="p-2 border">{new Date(maintenance.date).toLocaleDateString('fr-FR')}</td>
                <td className="p-2 border">
                  {machines.find((mo) => mo.id === maintenance.machineId)?.name || 'Inconnu'}
                </td>
                <td className="p-2 border">{maintenance.slot}</td>
                <td className="p-2 border">
                  <button
                    onClick={() => deleteMaintenanceById(maintenance.shift_id)}
                    className="p-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    <div className="p-4 max-w-full mx-auto">
      <div className="flex justify-center items-center gap-4 mb-8 bg-gray-50 rounded-lg p-4">
        <label className="text-lg font-medium">Sélection de l&apos;année :</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="p-3 border rounded text-lg"
        >
          {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034].map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      {renderMaintenanceTable()}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Gestion des Cellules Grisées</h2>
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setWeekType('even')}
            className={`p-2 rounded text-sm ${
              weekType === 'even' ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-100'
            }`}
          >
            Semaine Paire
          </button>
          <button
            onClick={() => setWeekType('odd')}
            className={`p-2 rounded text-sm ${
              weekType === 'odd' ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-100'
            }`}
          >
            Semaine Impaire
          </button>
          <button
            onClick={applyToYear}
            disabled={isLoading}
            className={`p-2 rounded text-sm flex items-center gap-2 ${
              isLoading
                ? 'bg-green-400 text-white cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Chargement...
              </>
            ) : (
              'Valider'
            )}
          </button>
          <button
            onClick={deleteAllNoDoctorAssignments}
            className="p-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Supprimer
          </button>
        </div>
        <div className="overflow-x-auto border rounded-lg text-sm">{renderTypicalWeekTable()}</div>
      </div>
    </div>
  );
}