import { useState, useCallback } from 'react';
import { supabase, getOrCreateWeekId, createShift, upsertDoctorAssignment, deleteDoctorAssignment, getAssignmentsForWeek, getCongesForWeek } from '@/lib/supabase/client';
import { Assignment, DoctorAssignment} from '../types';
import { formatDateKey } from '../utils'

export const useAssignments = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState<boolean>(false);

  // Fonction pour calculer le numéro de la semaine
  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
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
      setIsLoadingAssignments(true);
      const weekId = await getOrCreateWeekId(year, weekNumber);
      const timeSlots = [
        { display: 'Matin', value: 'matin' },
        { display: 'Après-midi', value: 'apres-midi' },
        { display: 'Soir', value: 'soir' },
      ];
  
      // Utiliser formatDateKey au lieu de toISOString()
      const shiftPromises = weekDays.flatMap((day, dayIndex) => {
        const slotsToShow = dayIndex === 5 ? [timeSlots[0]] : timeSlots;
        return slotsToShow.flatMap((slot) =>
          machines.map(async (machine) => {
            const dateStr = formatDateKey(day); // Modification ici
            const shiftId = await createShift(dateStr, slot.value, machine.id, weekId);
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

      // Fusionner les shifts créés avec les assignations existantes
      const newAssignments = await Promise.all(shiftPromises);
      const mergedAssignments = newAssignments.map((newAssignment) => {
        const existing = existingAssignments.find(
          (a) => a.day === newAssignment.day && a.slot === newAssignment.slot && a.machineId === newAssignment.machineId
        );
        return existing || newAssignment;
      });

      setAssignments(mergedAssignments);
    } catch (error) {
      console.error('Erreur lors du chargement des assignments:', error);
    } finally {
      setIsLoadingAssignments(false);
    }
  }, []);

  const handleAssignDoctor = useCallback(
    async (day: string, slot: string, machineId: string, doctorId: string) => {
      try {
        console.log('handleAssignDoctor called with:', { day, slot, machineId, doctorId });

        // Récupérer les congés pour la semaine
        const year = new Date(day).getFullYear();
        const weekNumber = getWeekNumber(new Date(day));
        const conges = await getCongesForWeek(year, weekNumber);

        // Récupérer les initiales du médecin
        const { data: doctorData, error: doctorError } = await supabase
          .from('doctors')
          .select('initials')
          .eq('id', doctorId)
          .single();

        if (doctorError) {
          console.error('Erreur lors de la récupération des initiales du médecin:', doctorError);
          return;
        }

        // Vérifier si le médecin est en congé
        if (conges[day]?.includes(doctorData.initials)) {
          console.log('Cannot assign doctor: Doctor is on leave');
          return;
        }

        // Normaliser le slot pour correspondre à shift_type
        const normalizedSlot = normalizeShiftType(slot);

        // Vérifier si le shift existe, sinon le créer
        const weekId = await getOrCreateWeekId(year, weekNumber);
        const shiftId = await createShift(day, normalizedSlot, machineId, weekId);

        // Récupérer les assignations existantes pour ce shift
        const { data: existingAssignments, error: fetchError } = await supabase
          .from('shift_assignments')
          .select('doctor_id, parts')
          .eq('shift_id', shiftId);

        if (fetchError) {
          console.error('Error fetching existing assignments:', fetchError);
          return;
        }

        console.log('Existing assignments:', { existingAssignments });

        // Calculer le total des parts existantes
        const totalParts = existingAssignments
          ? existingAssignments.reduce((sum, a) => sum + a.parts, 0)
          : 0;

        console.log('Total parts before assignment:', totalParts);

        if (totalParts >= 4) {
          console.log('Cannot assign doctor: Total parts limit reached (4)');
          return;
        }

        const existingDoctor = existingAssignments?.find(a => a.doctor_id === doctorId);
        const parts = existingDoctor ? (existingDoctor.parts + 1) : 1;

        console.log('Assigning doctor with parts:', { doctorId, parts });

        // Ajouter ou mettre à jour l'assignation
        await upsertDoctorAssignment(shiftId, doctorId, parts, false, false, false, false, false);

        // Rafraîchir les assignations depuis Supabase pour synchroniser l'état
        const updatedAssignments = await getAssignmentsForWeek(year, weekNumber);
        console.log('Updated assignments:', updatedAssignments);
        setAssignments(updatedAssignments);

        console.log('Assignments updated successfully');
      } catch (error) {
        console.error("Erreur lors de l'assignation du médecin:", error);
      }
    },
    []
  );

  const toggleDoctorOption = useCallback(
    async (params: {
      day: string;
      slot: string;
      machineId: string;
      doctorId: string;
      option: 'teleradiologie' | 'differe' | 'plusDiffere';
    }) => {
      const { day, slot, machineId, doctorId, option } = params;

      try {
        const assignmentIndex = assignments.findIndex(
          (a) => a.day === day && a.slot === slot && a.machineId === machineId
        );

        if (assignmentIndex === -1) {
          console.error('Assignment not found for:', { day, slot, machineId });
          return;
        }

        const assignment = assignments[assignmentIndex];
        const doctorIndex = assignment.doctors.findIndex((d: DoctorAssignment) => d.doctorId === doctorId);

        if (doctorIndex === -1) {
          console.error('Doctor not found in assignment:', { doctorId, assignment });
          return;
        }

        const doctor = assignment.doctors[doctorIndex];
        const updatedOptions = {
          teleradiologie: option === 'teleradiologie' ? !doctor.teleradiologie : doctor.teleradiologie,
          en_differe: option === 'differe' ? !doctor.differe : doctor.differe,
          lecture_differee: option === 'plusDiffere' ? !doctor.plusDiffere : doctor.plusDiffere,
        };

        // Appliquer la règle d'exclusivité entre teleradiologie et differe
        if (option === 'teleradiologie' && !doctor.teleradiologie) {
          updatedOptions.en_differe = false;
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
          updatedOptions.en_differe,
          updatedOptions.lecture_differee,
          false,
          false
        );

        // Rafraîchir les assignations depuis Supabase pour synchroniser l'état
        const year = new Date(day).getFullYear();
        const weekNumber = getWeekNumber(new Date(day));
        const updatedAssignments = await getAssignmentsForWeek(year, weekNumber);
        console.log('Updated assignments after toggle:', updatedAssignments);

        // Mettre à jour l'état local
        setAssignments(updatedAssignments);
      } catch (error) {
        console.error("Erreur lors de la modification de l'option:", error);
      }
    },
    [assignments]
  );

  const decreaseDoctorShare = useCallback(
    async (params: { day: string; slot: string; machineId: string; doctorId: string }) => {
      const { day, slot, machineId, doctorId } = params;

      try {
        console.log('decreaseDoctorShare called with:', { day, slot, machineId, doctorId });

        const assignmentIndex = assignments.findIndex(
          (a) => a.day === day && a.slot === slot && a.machineId === machineId
        );

        if (assignmentIndex === -1) {
          console.error('Assignment not found:', { day, slot, machineId });
          return;
        }

        const assignment = assignments[assignmentIndex];
        const doctor = assignment.doctors.find((d: DoctorAssignment) => d.doctorId === doctorId);

        if (!doctor) {
          console.error('Doctor not found:', { doctorId, assignment });
          return;
        }

        console.log('Current doctor share:', { doctorId, share: doctor.share });

        if (doctor.share <= 1) {
          // Supprimer l'assignation si share = 1
          console.log('Deleting doctor assignment:', { doctorId });
          await deleteDoctorAssignment(assignment.id!, doctorId, false, false);
        } else {
          // Réduire les parts et recalculer
          console.log('Decreasing doctor share:', { doctorId, newShare: doctor.share - 1 });
          await upsertDoctorAssignment(
            assignment.id!,
            doctorId,
            doctor.share - 1,
            doctor.teleradiologie,
            doctor.differe,
            doctor.plusDiffere,
            false,
            false
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
    async (params: { day: string; slot: string; machineId: string; doctorId: string }) => {
      const { day, slot, machineId, doctorId } = params;

      try {
        console.log('increaseDoctorShare called with:', { day, slot, machineId, doctorId });

        const assignmentIndex = assignments.findIndex(
          (a) => a.day === day && a.slot === slot && a.machineId === machineId
        );

        if (assignmentIndex === -1) {
          console.error('Assignment not found:', { day, slot, machineId });
          return;
        }

        const assignment = assignments[assignmentIndex];
        const totalShares = assignment.doctors.reduce((sum: any, d: { share: any; }) => sum + d.share, 0);

        console.log('Current total shares:', { totalShares });

        if (totalShares >= 4) {
          console.log('Cannot increase share: Total shares limit reached (4)');
          return;
        }

        const doctor = assignment.doctors.find((d: DoctorAssignment) => d.doctorId === doctorId);
        if (!doctor) {
          console.error('Doctor not found:', { doctorId, assignment });
          return;
        }

        console.log('Current doctor share:', { doctorId, share: doctor.share });

        // Augmenter les parts et recalculer
        console.log('Increasing doctor share:', { doctorId, newShare: doctor.share + 1 });
        await upsertDoctorAssignment(
          assignment.id!,
          doctorId,
          doctor.share + 1,
          doctor.teleradiologie,
          doctor.differe,
          doctor.plusDiffere,
          false,
          false
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
    async (params: { day: string; slot: string; machineId: string; doctorId: string }) => {
      const { day, slot, machineId, doctorId } = params;

      try {
        console.log('removeDoctor called with:', { day, slot, machineId, doctorId });

        const assignmentIndex = assignments.findIndex(
          (a) => a.day === day && a.slot === slot && a.machineId === machineId
        );

        if (assignmentIndex === -1) {
          console.error('Assignment not found:', { day, slot, machineId });
          return;
        }

        const assignment = assignments[assignmentIndex];

        // Supprimer l'assignation
        await deleteDoctorAssignment(assignment.id!, doctorId, false, false);

        // Rafraîchir les assignations depuis Supabase
        const year = new Date(day).getFullYear();
        const weekNumber = getWeekNumber(new Date(day));
        const updatedAssignments = await getAssignmentsForWeek(year, weekNumber);
        console.log('Updated assignments after remove:', updatedAssignments);
        setAssignments(updatedAssignments);
      } catch (error) {
        console.error("Erreur lors de la suppression du médecin:", error);
      }
    },
    [assignments]
  );

  return {
    assignments,
    isLoadingAssignments,
    loadAssignments,
    handleAssignDoctor,
    toggleDoctorOption,
    decreaseDoctorShare,
    increaseDoctorShare,
    removeDoctor,
  };
};