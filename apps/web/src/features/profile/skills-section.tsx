'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useProfileSettings, useSetSkills, useT } from '@careerpilot/client-core';
import { normalizeSkills } from '@careerpilot/dynamic-forms';
import { Card, TagInput } from '@careerpilot/ui-web';
import { sectionAnchor, useProfileFeedback } from './profile-support';

export function SkillsSection({ skills }: { skills: string[] }) {
  const t = useT();
  const feedback = useProfileFeedback();
  const { settings } = useProfileSettings();
  const save = useSetSkills();
  const [error, setError] = useState<string>();
  const limits = settings.limits;

  const commit = (next: string[], onSaved?: () => void) => {
    const normalized = normalizeSkills(next, limits.maxSkillLength);
    if (normalized.tooLong.length > 0) {
      setError(t('validation.skillTooLong', { max: limits.maxSkillLength, skills: normalized.tooLong.join(t('common.listSeparator')) }));
      return;
    }
    if (normalized.skills.length > limits.maxSkills) {
      setError(t('validation.skillLimit', { max: limits.maxSkills }));
      return;
    }
    setError(undefined);
    save.mutate(normalized.skills, { onSuccess: onSaved, onError: (failure) => feedback.failed(failure) });
  };

  const remove = (skill: string) => {
    const previous = skills;
    commit(
      skills.filter((s) => s !== skill),
      () => feedback.removed(skill, () => commit(previous)),
    );
  };

  return (
    <section id={sectionAnchor('skills')} aria-labelledby="profile-skills-title" className="scroll-mt-24">
      <Card className="gap-3">
        <div className="flex items-center gap-3">
          <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
          <h2 id="profile-skills-title" className="text-lg font-semibold">
            {t('profile.skills')}
          </h2>
        </div>
        {skills.length === 0 ? <p className="text-sm text-muted">{t('profile.skillsEmpty')}</p> : null}
        <TagInput
          label={t('profile.addSkill')}
          values={skills}
          placeholder={t('profile.skillPlaceholder')}
          hint={t('profile.skillsHint')}
          error={error}
          addLabel={t('common.add')}
          removeLabel={(skill) => t('profile.removeSkill', { skill })}
          onAdd={(tags) => commit([...skills, ...tags])}
          onRemove={remove}
        />
      </Card>
    </section>
  );
}
