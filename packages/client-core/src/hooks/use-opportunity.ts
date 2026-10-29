import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OpportunityDecision } from '@careerpilot/domain-ui-logic';
import { queryKeys } from '../query/query-keys';
import { useApi, useServices } from '../services/app-services';

export function useOpportunity(id: string) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.opportunity(id), queryFn: () => api.opportunities.getOpportunity(id) });
}

export function useDecide(id: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (decision: OpportunityDecision) => api.opportunities.decide(id, decision),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: queryKeys.opportunity(id) }), client.invalidateQueries({ queryKey: queryKeys.dashboard })]);
    },
  });
}

export function usePrepareApplication(id: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.opportunities.prepareApplication(id),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.approvals }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
        client.invalidateQueries({ queryKey: queryKeys.opportunity(id) }),
      ]);
    },
  });
}

export function useAddMissingSkill(id: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (skill: string) => {
      const profile = await api.profile.getProfile();
      return api.profile.setSkills([...profile.skills, skill]);
    },
    onSuccess: async (profile) => {
      client.setQueryData(queryKeys.profile, profile);
      await Promise.all([client.invalidateQueries({ queryKey: queryKeys.opportunity(id) }), client.invalidateQueries({ queryKey: queryKeys.dashboard })]);
    },
  });
}

export function learnSkillHref(template: string, skill: string): string {
  return template.replace('{skill}', encodeURIComponent(skill));
}

export function useLearnSkillHref(): (skill: string) => string {
  const { config } = useServices();
  return (skill) => learnSkillHref(config.ui.learnSkillUrl, skill);
}
