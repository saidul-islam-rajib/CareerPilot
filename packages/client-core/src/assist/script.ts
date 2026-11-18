import type { FillPlan } from '@careerpilot/api-client';
import { ASSIST_RUNTIME } from './runtime';

export const AssistCvState = { None: 'none', Attached: 'attached', Pick: 'pick' } as const;
export type AssistCvState = (typeof AssistCvState)[keyof typeof AssistCvState];

export const AssistLeftKind = { Protected: 'protected', Other: 'other' } as const;
export type AssistLeftKind = (typeof AssistLeftKind)[keyof typeof AssistLeftKind];

export interface AssistLeftItem {
  label: string;
  kind: AssistLeftKind;
}

export interface AssistStatus {
  filled: number;
  left: AssistLeftItem[];
  cv: AssistCvState;
  confirmation: string;
  url: string;
}

const BASE64_CHUNK = 0x8000;

export function buildAssistScript(plan: FillPlan): string {
  const config = {
    facts: plan.facts,
    answers: plan.answers,
    accountEmail: plan.accountEmail,
    coverLetter: plan.coverLetter,
    coverLetterLabels: plan.coverLetterLabels,
    resumeLabels: plan.resumeLabels,
    confirmationPhrases: plan.confirmationPhrases,
    skipTerms: plan.skipTerms,
    captchaSelectors: plan.captchaSelectors,
    scanIntervalMs: plan.scanIntervalMs,
    excerptChars: plan.excerptChars,
  };
  return `(${ASSIST_RUNTIME})(${JSON.stringify(config)});true;`;
}

export function passwordCommand(password: string): string {
  return `window.__cpAssist && window.__cpAssist.setPassword(${JSON.stringify(password)});true;`;
}

export function cvCommand(name: string, type: string, data: string): string {
  return `window.__cpAssist && window.__cpAssist.setCv(${JSON.stringify(name)},${JSON.stringify(type)},${JSON.stringify(data)});true;`;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK));
  }
  return btoa(binary);
}

export function parseAssistMessage(raw: string): AssistStatus | null {
  try {
    const value = JSON.parse(raw) as Partial<AssistStatus> & { type?: string };
    if (value.type !== 'status' || typeof value.filled !== 'number' || !Array.isArray(value.left)) {
      return null;
    }
    return {
      filled: value.filled,
      left: value.left,
      cv: value.cv ?? AssistCvState.None,
      confirmation: value.confirmation ?? '',
      url: value.url ?? '',
    };
  } catch {
    return null;
  }
}
