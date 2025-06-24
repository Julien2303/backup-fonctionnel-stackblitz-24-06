import { useState, useCallback } from 'react';
import { supabase, getOrCreateWeekId, createShift, upsertDoctorAssignment, deleteDoctorAssignment, getAssignmentsForWeek, getCongesForWeek } from '@/lib/supabase/client';
import { Assignment } from '../types';
import { getWeekNumber as getWeekNumberUtil } from '@/app/modification/planning/utils';

export const useAssignments = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Fonction pour calculer le numéro de la semaine (utilisation de la fonction de utils.ts)
  const getWeekNumber = (date: Date): number => {
    console.log('Calculating week number for date:', date);
    const { week } = getWeekNumberUtil(date);
    console.log('Week number calculated:', week);
    return week;
  };

  // Fonction pour normaliser les slots vers les valeurs de shift_type
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

  // Fonction pour charger les assignments et créer les shifts nécessaires
  const loadAssignments = useCallback(async (year: number, weekNumber: number, machines: { id: string }[], weekDays: Date[]) => {
    try {
      console.log('Loading assignments for:', { year, weekNumber, machines, weekDays });
      const weekId = await getOrCreateWeekId(year, weekNumber);
      console.log('Week ID obtained:', weekId);
      const timeSlots = [
        { display: 'Matin', value: 'matin' },
        { display: 'Après-midi', value: 'apres-midi' },
        { display: 'Soir', value: 'soir' },
      ];

      // Créer des shifts pour chaque jour, slot et machine si nécessaire
      const shiftPromises = weekDays.flatMap((day, dayIndex) => {
        const slotsToShow = dayIndex === 5 ? [timeSlots[0]] : timeSlots;
        return slotsToShow.flatMap((slot) =>
          machines.map(async (machine) => {
            const dateStr = day.toISOString().split('T')[0];
            const shiftId = await createShift(dateStr, slot.value, machine.id, weekId);
            console.log('Shift created:', { dateStr, slot: slot.display, machineId: machine.id, shiftId });
            return {
              id: shiftId,
              day: dateStr,
              slot: slot.display,
              machineId: machine.id,
              doctors: [],
            };
          })
        );
      });

      // Récupérer les assignations existantes depuis Supabase
      const existingAssignments = await getAssignmentsForWeek(year, weekNumber);
      console.log('Existing assignments fetched:', existingAssignments);

      // Fusionner les shifts créés avec les assignations existantes
      const newAssignments = await Promise.all(shiftPromises);
      const mergedAssignments = newAssignments.map((newAssignment) => {
        const existing = existingAssignments.find(
          (a) => a.day === newAssignment.day && a.slot === newAssignment.slot && a.machineId === newAssignment.machineId
        );
        return existing || newAssignment;
      });

      console.log('Merged assignments:', mergedAssignments);
      setAssignments(mergedAssignments);
    } catch (error) {
      console.error('Erreur lors du chargement des assignments:', error);
    }
  }, []);

  const handleAssignDoctor = useCallback(
    async (day: string, slot: string, machineId: string, doctorId: string | null, isMaintenance: boolean = false, isNoDoctor: boolean = false) => {
      try {
        console.log('handleAssignDoctor called with:', { day, slot, machineId, doctorId, isMaintenance, isNoDoctor });

        const year = new Date(day).getFullYear();
        const weekNumber = getWeekNumber(new Date(day));
        const normalizedSlot = normalizeShiftType(slot);
        console.log('Normalized slot:', normalizedSlot);

        const weekId = await getOrCreateWeekId(year, weekNumber);
        console.log('Week ID:', weekId);

        const shiftId = await createShift(day, normalizedSlot, machineId, weekId);
        console.log('Shift ID created:', shiftId);

        const { data: existingAssignments, error: fetchError } = await supabase
          .from('shift_assignments')
          .select('id, doctor_id, parts, maintenance, no_doctor, teleradiologie, en_differe, lecture_differee')
          .eq('shift_id', shiftId);
        console.log('Existing assignments:', { shiftId, existingAssignments, fetchError });

        if (fetchError) {
          console.error('Error fetching existing assignments:', fetchError);
          throw new Error(`Erreur lors de la récupération des assignations: ${fetchError.message}`);
        }

        // Calculer le total des parts existantes
        const totalParts = existingAssignments
          ? existingAssignments.reduce((sum, a) => sum + a.parts, 0)
          : 0;
        console.log('Total parts before assignment:', totalParts);

        if (totalParts >= 4) {
          console.log('Cannot assign: Total parts limit reached (4)');
          return;
        }

        // Vérifier si une assignation existe déjà pour doctorId, maintenance, no_doctor
        const existingAssignment = existingAssignments?.find(
          (a) => (a.doctor_id === doctorId || (doctorId === null && a.doctor_id === null)) && a.maintenance === isMaintenance && a.no_doctor === isNoDoctor
        );

        // Vérifier les congés si doctorId n'est pas null
        if (doctorId) {
          const conges = await getCongesForWeek(year, weekNumber);
          const { data: doctorData, error: doctorError } = await supabase
            .from('doctors')
            .select('initials')
            .eq('id', doctorId)
            .single();

          if (doctorError) {
            console.error('Erreur lors de la récupération des initiales du médecin:', doctorError);
            throw new Error(`Erreur lors de la récupération des initiales du médecin: ${doctorError.message}`);
          }

          if (conges[day]?.includes(doctorData.initials)) {
            console.log('Cannot assign doctor: Doctor is on leave');
            return;
          }
        }

        if (existingAssignment) {
          // Incrémenter les parts existantes
          const newParts = existingAssignment.parts + 1;
          console.log('Incrementing existing assignment:', { doctorId, isMaintenance, isNoDoctor, newParts });
          await upsertDoctorAssignment(
            shiftId,
            doctorId,
            newParts,
            existingAssignment.teleradiologie,
            existingAssignment.en_differe,
            existingAssignment.lecture_differee,
            isMaintenance,
            isNoDoctor
          );
        } else {
          // Créer une nouvelle assignation
          console.log('Creating new assignment:', { doctorId, parts: 1, isMaintenance, isNoDoctor });
          await upsertDoctorAssignment(
            shiftId,
            doctorId,
            1,
            false,
            false,
            false,
            isMaintenance,
            isNoDoctor
          );
        }

        // Rafraîchir les assignations depuis Supabase
        const updatedAssignments = await getAssignmentsForWeek(year, weekNumber);
        console.log('Updated assignments:', updatedAssignments);
        setAssignments(updatedAssignments);

        console.log('Assignments updated successfully');
      } catch (error) {
        console.error("Erreur lors de l'assignation:", error);
      }
    },
    []
  );

  const toggleDoctorOption = useCallback(
    async (params: {
      day: string;
      slot: string;
      machineId: string;
      doctorId: string | null;
      option: 'teleradiologie' | 'differe' | 'plusDiffere';
    }) => {
      const { day, slot, machineId, doctorId, option } = params;

      // Ne pas appliquer les options si doctorId est null
      if (!doctorId) {
        console.log('Cannot toggle options for maintenance or no doctor');
        return;
      }

      try {
        const assignmentIndex = assignments.findIndex(
          (a) => a.day === day && a.slot === slot && a.machineId === machineId
        );

        if (assignmentIndex === -1) {
          console.error('Assignment not found for:', { day, slot, machineId });
          return;
        }

        const assignment = assignments[assignmentIndex];
        const doctorIndex = assignment.doctors.findIndex((d) => d.doctorId === doctorId);

        if (doctorIndex === -1) {
          console.error('Doctor not found in assignment:', { doctorId, assignment });
          return;
        }

        const doctor = assignment.doctors[doctorIndex];
        const updatedOptions = {
          teleradiologie: option === 'teleradiologie' ? !doctor.teleradiologie : doctor.teleradiologie,
          differe: option === 'differe' ? !doctor.differe : doctor.differe,
          plusDiffere: option === 'plusDiffere' ? !doctor.plusDiffere : doctor.plusDiffere,
        };

        // Appliquer la règle d'exclusivité entre teleradiologie et differe
        if (option === 'teleradiologie' && !doctor.teleradiologie) {
          updatedOptions.differe = false;
        } else if (option === 'differe' && !doctor.differe) {
          updatedOptions.teleradiologie = false;
        }

        console.log('Toggling doctor option:', { day, slot, machineId, doctorId, option, updatedOptions });

        // Mettre à jour dans Supabase
        await upsertDoctorAssignment(
          assignment.id!,
          doctorId,
          doctor.share,
          updatedOptions.teleradiologie,
          updatedOptions.differe,
          updatedOptions.plusDiffere,
          doctor.maintenance || false,
          doctor.noDoctor || false
        );

        // Rafraîchir les assignations depuis Supabase
        const year = new Date(day).getFullYear();
        const weekNumber = getWeekNumber(new Date(day));
        const updatedAssignments = await getAssignmentsForWeek(year, weekNumber);
        console.log('Updated assignments after toggle:', updatedAssignments);
        setAssignments(updatedAssignments);
      } catch (error) {
        console.error("Erreur lors de la modification de l'option:", error);
      }
    },
    [assignments]
  );

  const decreaseDoctorShare = useCallback(
    async (params: { day: string; slot: string; machineId: string; doctorId: string | null; isMaintenance?: boolean; isNoDoctor?: boolean }) => {
      const { day, slot, machineId, doctorId, isMaintenance = false, isNoDoctor = false } = params;

      try {
        console.log('decreaseDoctorShare called with:', { day, slot, machineId, doctorId, isMaintenance, isNoDoctor });

        const assignmentIndex = assignments.findIndex(
          (a) => a.day === day && a.slot === slot && a.machineId === machineId
        );

        if (assignmentIndex === -1) {
          console.error('Assignment not found:', { day, slot, machineId });
          return;
        }

        const assignment = assignments[assignmentIndex];
        const doctor = assignment.doctors.find(
          (d) => (d.doctorId === doctorId || (doctorId === null && d.doctorId === null)) && d.maintenance === isMaintenance && d.noDoctor === isNoDoctor
        );

        if (!doctor) {
          console.error('Assignment not found:', { doctorId, isMaintenance, isNoDoctor, assignment });
          return;
        }

        console.log('Current share:', { doctorId, share: doctor.share, isMaintenance, isNoDoctor });

        if (doctor.share <= 1) {
          // Supprimer l'assignation si share = 1
          console.log('Deleting assignment:', { doctorId, isMaintenance, isNoDoctor });
          await deleteDoctorAssignment(assignment.id!, doctorId, isMaintenance, isNoDoctor);
        } else {
          // Réduire les parts
          console.log('Decreasing share:', { doctorId, newShare: doctor.share - 1, isMaintenance, isNoDoctor });
          await upsertDoctorAssignment(
            assignment.id!,
            doctorId,
            doctor.share - 1,
            doctor.teleradiologie,
            doctor.differe,
            doctor.plusDiffere,
            isMaintenance,
            isNoDoctor
          );
        }

        // Rafraîchir les assignations depuis Supabase
        const year = new Date(day).getFullYear();
        const weekNumber = getWeekNumber(new Date(day));
        const updatedAssignments = await getAssignmentsForWeek(year, weekNumber);
        console.log('Updated assignments after decrease:', updatedAssignments);
        setAssignments(updatedAssignments);
      } catch (error) {
        console.error("Erreur lors de la réduction des parts:", error);
      }
    },
    [assignments]
  );

  const increaseDoctorShare = useCallback(
    async (params: { day: string; slot: string; machineId: string; doctorId: string | null; isMaintenance?: boolean; isNoDoctor?: boolean }) => {
      const { day, slot, machineId, doctorId, isMaintenance = false, isNoDoctor = false } = params;

      try {
        console.log('increaseDoctorShare called with:', { day, slot, machineId, doctorId, isMaintenance, isNoDoctor });

        const assignmentIndex = assignments.findIndex(
          (a) => a.day === day && a.slot === slot && a.machineId === machineId
        );

        if (assignmentIndex === -1) {
          console.error('Assignment not found:', { day, slot, machineId });
          return;
        }

        const assignment = assignments[assignmentIndex];
        const totalShares = assignment.doctors.reduce((sum, d) => sum + d.share, 0);

        console.log('Current total shares:', { totalShares });

        if (totalShares >= 4) {
          console.log('Cannot increase share: Total shares limit reached (4)');
          return;
        }

        const doctor = assignment.doctors.find(
          (d) => (d.doctorId === doctorId || (doctorId === null && d.doctorId === null)) && d.maintenance === isMaintenance && d.noDoctor === isNoDoctor
        );
        if (!doctor) {
          console.error('Assignment not found:', { doctorId, isMaintenance, isNoDoctor, assignment });
          return;
        }

        console.log('Current doctor share:', { doctorId, share: doctor.share });

        // Augmenter les parts
        console.log('Increasing doctor share:', { doctorId, newShare: doctor.share + 1 });
        await upsertDoctorAssignment(
          assignment.id!,
          doctorId,
          doctor.share + 1,
          doctor.teleradiologie,
          doctor.differe,
          doctor.plusDiffere,
          isMaintenance,
          isNoDoctor
        );

        // Rafraîchir les assignations depuis Supabase
        const year = new Date(day).getFullYear();
        const weekNumber = getWeekNumber(new Date(day));
        const updatedAssignments = await getAssignmentsForWeek(year, weekNumber);
        console.log('Updated assignments after increase:', updatedAssignments);
        setAssignments(updatedAssignments);
      } catch (error) {
        console.error("Erreur lors de l'augmentation des parts:", error);
      }
    },
    [assignments]
  );

  const removeDoctor = useCallback(
    async (params: { day: string; slot: string; machineId: string; doctorId: string | null; isMaintenance?: boolean; isNoDoctor?: boolean }) => {
      const { day, slot, machineId, doctorId, isMaintenance = false, isNoDoctor = false } = params;

      try {
        console.log('removeDoctor called with:', { day, slot, machineId, doctorId, isMaintenance, isNoDoctor });

        const assignmentIndex = assignments.findIndex(
          (a) => a.day === day && a.slot === slot && a.machineId === machineId
        );

        if (assignmentIndex === -1) {
          console.error('Assignment not found:', { day, slot, machineId });
          return;
        }

        const assignment = assignments[assignmentIndex];

        // Supprimer l'assignation
        await deleteDoctorAssignment(assignment.id!, doctorId, isMaintenance, isNoDoctor);

        // Rafraîchir les assignations depuis Supabase
        const year = new Date(day).getFullYear();
        const weekNumber = getWeekNumber(new Date(day));
        const updatedAssignments = await getAssignmentsForWeek(year, weekNumber);
        console.log('Updated assignments after remove:', updatedAssignments);
        setAssignments(updatedAssignments);
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
      }
    },
    [assignments]
  );

  return {
    assignments,
    loadAssignments,
    handleAssignDoctor,
    toggleDoctorOption,
    decreaseDoctorShare,
    increaseDoctorShare,
    removeDoctor,
  };
};