import type { UploadSource } from '../types';
import type {
  Circular,
  CircularContent,
  CircularFilters,
  CircularNotice,
  CircularSummary,
  CircularVersion,
  CircularView,
  ConnectorDraft,
  FeeChange,
  GovApplication,
  GovHoliday,
  GovReference,
  GuideStep,
  SecretValues,
  StageInput,
  UpcomingItem,
} from './types';

export interface GovernmentApi {
  reference(): Promise<GovReference>;
  listCirculars(filters?: CircularFilters): Promise<CircularSummary[]>;
  getCircular(id: string): Promise<CircularView>;
  getCircularVersion(id: string, version: number): Promise<CircularVersion>;
  listApplications(): Promise<GovApplication[]>;
  getApplication(id: string): Promise<GovApplication>;
  startApplication(circularId: string, postIds: string[]): Promise<GovApplication>;
  withdrawApplication(id: string): Promise<void>;
  markSubmitted(id: string): Promise<GovApplication>;
  confirmApplication(id: string): Promise<GovApplication>;
  updateFee(id: string, change: FeeChange): Promise<GovApplication>;
  addStage(id: string, stage: StageInput): Promise<GovApplication>;
  updateStage(id: string, stageId: string, stage: StageInput): Promise<GovApplication>;
  removeStage(id: string, stageId: string): Promise<GovApplication>;
  addCopy(id: string, file: UploadSource): Promise<GovApplication>;
  removeCopy(id: string, copyId: string): Promise<GovApplication>;
  setSecrets(id: string, values: SecretValues): Promise<GovApplication>;
  revealSecrets(id: string): Promise<SecretValues>;
  guide(id: string): Promise<GuideStep[]>;
  upcoming(): Promise<UpcomingItem[]>;
}

export interface GovernmentAdminApi {
  reference(): Promise<GovReference>;
  listCirculars(): Promise<Circular[]>;
  getCircular(id: string): Promise<Circular>;
  createCircular(content: CircularContent): Promise<Circular>;
  updateCircular(id: string, content: CircularContent): Promise<Circular>;
  publishCircular(id: string): Promise<Circular>;
  withdrawCircular(id: string): Promise<Circular>;
  setLiveRemoved(id: string, removed: boolean): Promise<Circular>;
  addNotice(id: string, notice: Omit<CircularNotice, 'id'>): Promise<Circular>;
  removeCircular(id: string): Promise<void>;
  importFromLink(url: string): Promise<ConnectorDraft>;
  listHolidays(): Promise<GovHoliday[]>;
  addHoliday(on: string, name: string): Promise<GovHoliday>;
  removeHoliday(id: string): Promise<void>;
}
