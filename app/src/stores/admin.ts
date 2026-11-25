import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import adminJson from '../data/config/admin.json';
import { baseConfig } from '../data/config';
import type { DaySchedule, ShiftDef } from '../data/types';
import type {
  AlertRule,
  ReportSchedule,
  ReportTemplateId,
} from '../services/ReportService.schedule';
import { jsonStorage, STORAGE_PREFIX } from './storage';

/**
 * Admin area state (Settings and Reports pages): plant profile edits,
 * "last checked" dates of tariffs/factors, alert rules, users, report
 * auto-send schedules and the simulated send log. Tariffs, budgets, factors
 * and targets stay in useSettingsStore (they drive every calculation).
 */

export type UserRole = 'director' | 'energy_manager' | 'operator' | 'esg' | 'admin';
export const USER_ROLES: UserRole[] = ['director', 'energy_manager', 'operator', 'esg', 'admin'];
export type Permission = 'view' | 'reports' | 'approve' | 'settings' | 'users';
export const PERMISSIONS: Permission[] = ['view', 'reports', 'approve', 'settings', 'users'];
export const ROLE_PERMISSIONS = adminJson.rolePermissions as Record<UserRole, Permission[]>;

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface PlantProfileEdit {
  name: string;
  sector: string;
  location: string;
  areaM2: number;
  schedule: { weekday: DaySchedule; saturday: DaySchedule; sunday: DaySchedule };
  shifts: ShiftDef[];
  holidays: string[];
}

/** Ids of values that carry a "last checked" date. */
export type CheckedId =
  | 'tariff.electricity'
  | 'tariff.gas'
  | 'emission.scope1'
  | 'emission.scope2'
  | 'emission.gasKwhPerM3'
  | 'emission.cbam';

export interface SendLogEntry {
  id: string;
  scheduleId: string | null;
  template: ReportTemplateId;
  format: 'pdf' | 'csv';
  at: number;
  recipients: string[];
}

export interface UploadRecord {
  id: string;
  name: string;
  rows: number;
  errors: number;
  at: number;
}

export interface AdminState {
  plant: Partial<PlantProfileEdit>;
  checked: Partial<Record<CheckedId, string>>;
  alertRules: AlertRule[];
  alertContacts: { email: string; telegram: string };
  users: AppUser[];
  schedules: ReportSchedule[];
  sendLog: SendLogEntry[];
  uploads: UploadRecord[];
  setPlant: (patch: Partial<PlantProfileEdit>) => void;
  markChecked: (id: CheckedId, isoDate: string) => void;
  updateAlertRule: (id: AlertRule['id'], patch: Partial<AlertRule>) => void;
  setAlertContacts: (patch: Partial<AdminState['alertContacts']>) => void;
  addUser: (u: Omit<AppUser, 'id'>) => void;
  updateUser: (id: string, patch: Partial<AppUser>) => void;
  removeUser: (id: string) => void;
  upsertSchedule: (s: ReportSchedule) => void;
  removeSchedule: (id: string) => void;
  logSend: (e: Omit<SendLogEntry, 'id'>) => void;
  addUpload: (u: Omit<UploadRecord, 'id'>) => void;
  /** reset the Settings page part (plant, checked dates, alerts, users, uploads) */
  resetSettings: () => void;
}

/** Plant profile defaults from plant.json. */
export const defaultPlantProfile: PlantProfileEdit = {
  name: baseConfig.plant.name,
  sector: baseConfig.plant.sector,
  location: baseConfig.plant.location,
  areaM2: baseConfig.plant.areaM2,
  schedule: baseConfig.plant.schedule,
  shifts: baseConfig.plant.shifts,
  holidays: baseConfig.plant.holidays,
};

/** Alert defaults; peak and stale thresholds follow plant.json / analysis.json. */
export function defaultAlertRules(): AlertRule[] {
  return (adminJson.alertRules as AlertRule[]).map((r) => ({
    ...r,
    channels: { ...r.channels },
    threshold:
      r.id === 'peak'
        ? baseConfig.plant.peakLimitKw
        : r.id === 'stale'
          ? baseConfig.analysis.staleAfterMinutes
          : r.threshold,
  }));
}

const defaultUsers = () => (adminJson.users as AppUser[]).map((u) => ({ ...u }));
export const defaultSchedules = () =>
  (adminJson.schedules as ReportSchedule[]).map((s) => ({ ...s, recipients: [...s.recipients] }));

let seq = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      plant: {},
      checked: {},
      alertRules: defaultAlertRules(),
      alertContacts: { ...adminJson.alertContacts },
      users: defaultUsers(),
      schedules: defaultSchedules(),
      sendLog: [],
      uploads: [],
      setPlant: (patch) => set((s) => ({ plant: { ...s.plant, ...patch } })),
      markChecked: (id, isoDate) => set((s) => ({ checked: { ...s.checked, [id]: isoDate } })),
      updateAlertRule: (id, patch) =>
        set((s) => ({
          alertRules: s.alertRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      setAlertContacts: (patch) =>
        set((s) => ({ alertContacts: { ...s.alertContacts, ...patch } })),
      addUser: (u) => set((s) => ({ users: [...s.users, { ...u, id: newId('u') }] })),
      updateUser: (id, patch) =>
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
      removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
      upsertSchedule: (sch) =>
        set((s) => {
          const id = sch.id || newId('s');
          const exists = s.schedules.some((x) => x.id === id);
          return {
            schedules: exists
              ? s.schedules.map((x) => (x.id === id ? { ...sch, id } : x))
              : [...s.schedules, { ...sch, id }],
          };
        }),
      removeSchedule: (id) => set((s) => ({ schedules: s.schedules.filter((x) => x.id !== id) })),
      logSend: (e) =>
        set((s) => ({ sendLog: [{ ...e, id: newId('log') }, ...s.sendLog].slice(0, 20) })),
      addUpload: (u) =>
        set((s) => ({ uploads: [{ ...u, id: newId('up') }, ...s.uploads].slice(0, 10) })),
      resetSettings: () =>
        set({
          plant: {},
          checked: {},
          alertRules: defaultAlertRules(),
          alertContacts: { ...adminJson.alertContacts },
          users: defaultUsers(),
          uploads: [],
        }),
    }),
    { name: `${STORAGE_PREFIX}admin`, storage: jsonStorage, version: 1 },
  ),
);

/** Effective plant profile (plant.json + Settings edits). */
export function usePlantProfile(): PlantProfileEdit {
  const plant = useAdminStore((s) => s.plant);
  return useMemo(() => ({ ...defaultPlantProfile, ...plant }), [plant]);
}

/** Area, schedule or shifts differ from the profile the baseline models were built with. */
export function staticFactorsChanged(p: PlantProfileEdit): boolean {
  return (
    p.areaM2 !== defaultPlantProfile.areaM2 ||
    JSON.stringify(p.schedule) !== JSON.stringify(defaultPlantProfile.schedule) ||
    JSON.stringify(p.shifts) !== JSON.stringify(defaultPlantProfile.shifts)
  );
}
