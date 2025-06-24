export interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
  color: string;
  initials: string;
  is_active: boolean;
  type: 'associé' | 'remplaçant';
}

export interface Machine {
  id: string;
  name: string;
  description?: string;
  site?: string;
}

export interface DoctorAssignment {
  doctorId: string | null;
  teleradiologie: boolean;
  differe: boolean;
  plusDiffere: boolean;
  pct_mutualisation: number;
  maintenance: boolean;
  noDoctor: boolean;
  share: number;
}

export interface Assignment {
  id: string;
  day: string;
  slot: string;
  machineId: string;
  doctors: DoctorAssignment[];
}

export interface Garde {
  id: string;
  date: string;
  jour: string;
  jour_ferie?: boolean;
  medecin_cds_id?: string;
  medecin_st_ex_id?: string;
  noel?: boolean;
  nouvel_an?: boolean;
  medecin_cds?: Doctor;
  medecin_st_ex?: Doctor;
}

// Types pour les props des composants
export interface WeekNavigationProps {
  currentDate: Date;
  selectedWeek: number;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  setSelectedWeek: React.Dispatch<React.SetStateAction<number>>;
  setExpandedCell: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string } | null>>;
  setSelectedDoctor: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string; doctorId: string | null } | null>>;
  weekDays: Date[];
}

export interface MachineFilterProps {
  machines: Machine[];
  selectedMachines: string[];
  toggleMachine: (machineId: string) => void;
  toggleSite: (site: string) => void;
}

export interface AssignmentCellProps {
  day: string;
  slot: string;
  machine: Machine;
  doctors: Doctor[];
  assignments: Assignment[];
  expandedCell: { day: string; slot: string; machineId: string } | null;
  setExpandedCell: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string } | null>>;
  setSelectedDoctor: React.Dispatch<React.SetStateAction<{ day: string; slot: string; machineId: string; doctorId: string | null } | null>>;
  handleAssignDoctor: (day: string, slot: string, machineId: string, doctorId: string | null, isMaintenance?: boolean, isNoDoctor?: boolean) => void;
  decreaseDoctorShare: (params: { day: string; slot: string; machineId: string; doctorId: string | null; isMaintenance?: boolean; isNoDoctor?: boolean }) => void;
  conges: Record<string, string[]>;
}

export interface DoctorMenuProps {
  doctor?: Doctor;
  assignment: DoctorAssignment;
  onToggleOption: (option: 'teleradiologie' | 'differe' | 'plusDiffere') => void;
  onDecreaseShare: () => void;
  onIncreaseShare: () => void;
  onRemove: () => void;
  onClose: () => void;
  totalShares: number;
}