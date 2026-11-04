import { describe, expect, it } from 'vitest';
import { ApplicationRoute, DryRunOutcome, SkipReason, SubmissionWindowKind } from '@careerpilot/domain-ui-logic';
import { ApiError, ApiErrorCode } from '../errors';
import { createInMemoryAutomation } from './in-memory';
import type { RuleInput } from './types';

const clock = { now: () => new Date('2026-11-01T06:00:00.000Z') };
const respond = <T>(value: T) => Promise.resolve(value);
const fail = (code: ApiErrorCode) => Promise.reject(new ApiError(code));
let counter = 0;
const ids = { next: (prefix: string) => `${prefix}_${++counter}` };
const candidates = [
  { id: 'opp_a', title: 'Frontend', organization: 'Northwind', trackId: 'trk_a', matchScore: 90, route: ApplicationRoute.Email, countryCode: 'BD' },
  { id: 'opp_b', title: 'Backend', organization: 'Kite', trackId: 'trk_a', matchScore: 50, route: ApplicationRoute.Email, countryCode: 'BD' },
];

function rule(name: string, minMatchScore = 0): RuleInput {
  return {
    name,
    enabled: true,
    trackIds: [],
    filters: { minMatchScore, allowedRoutes: [], countries: [], excludedEmployers: [], excludedKeywords: [], allowUnknownRequirements: false },
    materials: {},
    limits: {},
    schedule: { kind: SubmissionWindowKind.AsSoonAsReady, days: [] },
  };
}

function create() {
  return createInMemoryAutomation({ clock, ids, respond, fail, candidates: () => candidates });
}

describe('in-memory automation', () => {
  it('creates, orders, updates and deletes rules', async () => {
    const api = create();
    const first = await api.createRule(rule('First'));
    const second = await api.createRule(rule('Second'));
    expect((await api.reorderRules([second.id, first.id])).map((r) => r.name)).toEqual(['Second', 'First']);
    expect((await api.updateRule(first.id, rule('Renamed'))).name).toBe('Renamed');
    await api.deleteRule(second.id);
    expect((await api.overview()).rules.map((r) => r.id)).toEqual([first.id]);
    await expect(api.createRule(rule(' '))).rejects.toMatchObject({ code: ApiErrorCode.Validation });
    await expect(api.updateRule('missing', rule('x'))).rejects.toMatchObject({ code: ApiErrorCode.NotFound });
  });

  it('previews without submitting anything', async () => {
    const api = create();
    const strict = await api.createRule(rule('Strict', 80));
    const result = await api.dryRun(strict.id);
    expect(result.submitted).toBe(0);
    expect(result.items.find((i) => i.opportunityId === 'opp_a')?.outcome).toBe(DryRunOutcome.WouldApply);
    const low = result.items.find((i) => i.opportunityId === 'opp_b');
    expect(low?.outcome).toBe(DryRunOutcome.Skipped);
    expect(low?.reasons).toEqual([SkipReason.BelowScore]);
  });

  it('keeps settings', async () => {
    const api = create();
    expect((await api.updateSettings({ weeklyCap: 5 })).weeklyCap).toBe(5);
    expect((await api.overview()).settings.weeklyCap).toBe(5);
  });
});
