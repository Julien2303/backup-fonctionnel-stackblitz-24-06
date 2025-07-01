'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { WeekNavigation } from './WeekNavigation';
import { getValidatedWeeks } from '@/lib/supabase/client';
import { formatDateKey } from './utils'; 
import { useAuth } from '@/lib/auth';

interface Doctor {
  id: string;
  initials: string;
  color: string;
  type: string;
}

interface Machine {
  id: string;
  name: string;
}

interface ShiftAssignment {
  doctor_id: string;
  machine_id?: string;
  date?: string;
  shift_type?: string;
  teleradiologie: boolean;
  en_differe: boolean;
  lecture_differee: boolean;
  mutualise: boolean;
  pct_mutualisation: number;
}

interface StrictShiftAssignment extends ShiftAssignment {
  machine_id: string;
  date: string;
  shift_type: string;
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const SHIFTS = {
  Lundi: ['Matin', 'apres-midi', 'Soir'],
  Mardi: ['Matin', 'apres-midi', 'Soir'],
  Mercredi: ['Matin', 'apres-midi', 'Soir'],
  Jeudi: ['Matin', 'apres-midi', 'Soir'],
  Vendredi: ['Matin', 'apres-midi', 'Soir'],
  Samedi: ['Matin']
};

const getWeekDates = (year: number, week: number): Date[] => {
  const startDate = new Date(year, 0, 1);
  startDate.setDate(startDate.getDate() + (week - 1) * 7 - startDate.getDay() + 1);
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });
};

const getWeekNumber = (date: Date): { week: number; year: number } => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getFullYear() };
};

const findClosestValidatedWeek = (week: number, year: number, validated: number[]): { week: number; year: number } => {
  if (validated.includes(week)) {
    return { week, year };
  }
  const sortedWeeks = validated.sort((a, b) => a - b);
  let closestWeek = sortedWeeks[0] || 1;
  let minDiffusion = Infinity;
  sortedWeeks.forEach((w) => {
    const diff = Math.abs(w - week);
    if (diff < minDiffusion) {
      minDiffusion = diff;
      closestWeek = w;
    }
  });
  return { week: closestWeek, year };
};

const DoctorSchedule: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedWeek, setSelectedWeek] = useState<number>(23);
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [assignments, setAssignments] = useState<StrictShiftAssignment[]>([]);
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [validatedWeeks, setValidatedWeeks] = useState<number[]>([]);
  const [expandedCell, setExpandedCell] = useState<{ day: string; slot: string; machineId: string } | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<{ day: string; slot: string; machineId: string; doctorId: string } | null>(null);

  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion', 'user']);

  const fetchDoctors = useCallback(async () => {
    const { data, error } = await supabase
      .from('doctors')
      .select('id, initials, color, type')
      .eq('is_active', true);
    if (error) {
      console.error('Erreur lors de la récupération des médecins:', error);
      return;
    }
    const sortedDoctors = data.sort((a: Doctor, b: Doctor) => {
      if (a.type === 'associé' && b.type !== 'associé') return -1;
      if (a.type !== 'associé' && b.type === 'associé') return 1;
      return 0;
    });
    setDoctors(sortedDoctors);
  }, []);

  const fetchMachines = useCallback(async () => {
    const { data, error } = await supabase
      .from('machines')
      .select('id, name')
      .eq('is_active', true);
    if (error) {
      console.error('Erreur lors de la récupération des machines:', error);
      return;
    }
    setMachines(data);
  }, []);

  const fetchAssignments = useCallback(async () => {
    if (!weekDays.length) return;

    const weekId = await supabase
      .from('weeks')
      .select('id')
      .eq('year', selectedYear)
      .eq('week_number', selectedWeek)
      .single()
      .then(res => res.data?.id);

    if (!weekId) {
      console.warn('Aucun ID de semaine trouvé pour l\'année et la semaine sélectionnées');
      setAssignments([]);
      return;
    }

    const startDate = formatDateKey(weekDays[0]);
    const endDate = formatDateKey(weekDays[5]);

    const { data, error } = await supabase
      .from('shift_assignments')
      .select(`
        doctor_id,
        shifts (
          date,
          shift_type,
          machine_id
        ),
        teleradiologie,
        en_differe,
        lecture_differee,
        mutualise,
        pct_mutualisation
      `)
      .eq('shifts.week_id', weekId)
      .gte('shifts.date', startDate)
      .lte('shifts.date', endDate);

    if (error) {
      console.error('Erreur lors de la récupération des assignations:', error);
      setAssignments([]);
      return;
    }

    const formattedAssignments = data
      .map((assignment: any) => {
        if (!assignment.shifts?.date) return null;

        return {
          doctor_id: assignment.doctor_id,
          machine_id: assignment.shifts?.machine_id,
          date: assignment.shifts.date,
          shift_type: assignment.shifts?.shift_type,
          teleradiologie: assignment.teleradiologie,
          en_differe: assignment.en_differe,
          lecture_differee: assignment.lecture_differee,
          mutualise: assignment.mutualise,
          pct_mutualisation: assignment.pct_mutualisation,
        };
      })
      .filter((a): a is StrictShiftAssignment => a !== null && !!a.machine_id && !!a.date && !!a.shift_type);

    setAssignments(formattedAssignments);
  }, [selectedWeek, selectedYear, weekDays]);

  useEffect(() => {
    const initializeData = async () => {
      try {
        await fetchDoctors();
        await fetchMachines();
        const validated = await getValidatedWeeks(selectedYear);
        setValidatedWeeks(validated || []);

        const today = new Date();
        const { week: todayWeek, year: todayYear } = getWeekNumber(today);
        const { week: closestWeek, year: closestYear } = findClosestValidatedWeek(todayWeek, todayYear, validated);
        const closestDate = getWeekDates(closestYear, closestWeek)[0];

        setCurrentDate(closestDate);
        setSelectedWeek(closestWeek);
        setSelectedYear(closestYear);
        setWeekDays(getWeekDates(closestYear, closestWeek));
      } catch (error) {
        console.error('Erreur lors de l\'initialisation des données:', error);
        setValidatedWeeks([]);
      }
    };
    initializeData();
  }, [fetchDoctors, fetchMachines]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const getMachineAssignments = (doctorId: string, date: string, shift: string) => {
    const doctorAssignments = assignments.filter(
      a => a.doctor_id === doctorId && a.date === date && a.shift_type?.toLowerCase() === shift.toLowerCase()
    );

    if (!doctorAssignments.length) return null;

    const hasTeleradiologie = doctorAssignments.some(a => a.teleradiologie);
    const hasLectureDifferee = doctorAssignments.some(a => a.lecture_differee);

    const completeMachines: string[] = [];
    const mutualisedMachines: { name: string; pct: number }[] = [];
    const deferredMachines: string[] = [];
    const mutualisedDeferredMachines: { name: string; pct: number }[] = [];

    doctorAssignments.forEach(a => {
      const machine = machines.find(m => m.id === a.machine_id)?.name || '';
      if (!a.mutualise && !a.en_differe) {
        completeMachines.push(machine);
      } else if (a.mutualise && !a.en_differe) {
        mutualisedMachines.push({ name: machine, pct: Math.round(a.pct_mutualisation) });
      } else if (!a.mutualise && a.en_differe) {
        deferredMachines.push(machine);
      } else if (a.mutualise && a.en_differe) {
        mutualisedDeferredMachines.push({ name: machine, pct: Math.round(a.pct_mutualisation) });
      }
    });

    const adjustedMutualised = mutualisedMachines
      .map((m: { name: string; pct: number }) => {
        if (m.pct === 33 || m.pct === 34) return { ...m, pct: 33 };
        if (m.pct === 66 || m.pct === 67) return { ...m, pct: 66 };
        return m;
      });

    const adjustedMutualisedDeferred = mutualisedDeferredMachines
      .map((m: { name: string; pct: number }) => {
        if (m.pct === 33 || m.pct === 34) return { ...m, pct: 33 };
        if (m.pct === 66 || m.pct === 67) return { ...m, pct: 66 };
        return m;
      });

    return (
      <div className="flex flex-col items-center">
        {hasTeleradiologie && (
          <div className="text-green-600 font-bold">TELERADIOLOGIE</div>
        )}
        {completeMachines.map((machine, idx: number) => (
          <div key={idx} className="text-black">{machine}</div>
        ))}
        {adjustedMutualised.map((m: { name: string; pct: number }, idx: number) => (
          <div key={idx} className="text-sm italic">
            {m.name} - {m.pct}%
          </div>
        ))}
        {hasLectureDifferee && (
          <div className="text-blue-600 text-sm font-bold underline">+ différés</div>
        )}
        {deferredMachines.map((machine, idx: number) => (
          <div key={idx} className="text-red-600 text-sm font-bold">
            ({machine})
          </div>
        ))}
        {adjustedMutualisedDeferred.map((m: { name: string; pct: number }, idx: number) => (
          <div key={idx} className="text-red-600 text-sm font-bold italic">
            ({m.name} - {m.pct}%)
          </div>
        ))}
      </div>
    );
  };

  const getDayBorderClass = (dayIdx: number, shiftIdx: number) => {
    const dayName = DAYS[dayIdx];
    const totalShifts = SHIFTS[dayName as keyof typeof SHIFTS].length;
    const isLastShiftOfDay = shiftIdx === totalShifts - 1;
    
    return isLastShiftOfDay ? 'border-r-2 border-r-gray-400' : 'border-r';
  };

  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }
  
  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  return (
    <div className="p-4">
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
        validatedWeeks={validatedWeeks}
        setValidatedWeeks={setValidatedWeeks}
      />
      {validatedWeeks.length === 0 ? (
        <div className="p-4 text-red-600">Aucune semaine validée pour cette année.</div>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="border-collapse w-full">
            <thead>
              <tr>
                <th className="border border-r-2 border-r-gray-400 p-2 bg-gray-100">Médecin</th>
                {weekDays.map((date, idx) => {
                  const dayName = DAYS[idx];
                  const isLastDay = idx === weekDays.length - 1;
                  return (
                    <th 
                      key={idx} 
                      className={`border p-2 bg-gray-100 ${isLastDay ? '' : 'border-r-2 border-r-gray-400'}`}
                      colSpan={dayName === 'Samedi' ? 1 : 3}
                    >
                      {dayName} {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </th>
                  );
                })}
              </tr>
              <tr className="border-b-2 border-b-gray-400">
                <th className="border border-r-2 border-r-gray-400 p-2 bg-gray-100"></th>
                {weekDays.map((date, idx) => {
                  const dayName = DAYS[idx];
                  return (
                    <React.Fragment key={idx}>
                      {SHIFTS[dayName as keyof typeof SHIFTS].map((shift, sIdx) => (
                        <th 
                          key={sIdx} 
                          className={`border p-2 bg-gray-100 ${getDayBorderClass(idx, sIdx)}`}
                        >
                          {shift === 'apres-midi' ? 'Après-midi' : shift}
                        </th>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {doctors.map(doctor => (
                <tr key={doctor.id} style={{ backgroundColor: doctor.color || '#ffffff' }}>
                  <td className="border border-r-2 border-r-gray-400 p-2 text-center font-bold text-black">{doctor.initials}</td>
                  {weekDays.map((date, idx) => {
                    const dayName = DAYS[idx];
                    const normalizedDate = new Date(date);
                    normalizedDate.setMinutes(normalizedDate.getMinutes() - normalizedDate.getTimezoneOffset());
                    const dateStr = normalizedDate.toISOString().split('T')[0];
                    return (
                      <React.Fragment key={idx}>
                        {SHIFTS[dayName as keyof typeof SHIFTS].map((shift, sIdx) => (
                          <td 
                            key={sIdx} 
                            className={`border p-2 text-center ${getDayBorderClass(idx, sIdx)}`}
                          >
                            {getMachineAssignments(doctor.id, dateStr, shift.toLowerCase())}
                          </td>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DoctorSchedule;