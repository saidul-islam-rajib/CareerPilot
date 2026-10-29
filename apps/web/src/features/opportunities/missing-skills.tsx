'use client';

import { useState } from 'react';
import { BookOpen, Check, Plus, Sparkles } from 'lucide-react';
import { useAddMissingSkill, useLearnSkillHref, useT } from '@careerpilot/client-core';
import { Button, Card, Section, buttonVariants, useToast } from '@careerpilot/ui-web';

export function SkillChips({ skills }: { skills: string[] }) {
  const t = useT();
  if (skills.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted">{t('opportunity.skillsToAdd')}</span>
      {skills.map((skill) => (
        <span key={skill} className="rounded-full border border-dashed border-input px-2 py-0.5 font-medium text-foreground">
          {skill}
        </span>
      ))}
    </div>
  );
}

export function MissingSkills({ opportunityId, skills }: { opportunityId: string; skills: string[] }) {
  const t = useT();
  const toast = useToast();
  const learnHref = useLearnSkillHref();
  const add = useAddMissingSkill(opportunityId);
  const [adding, setAdding] = useState<string | null>(null);
  if (skills.length === 0) {
    return null;
  }
  const addSkill = (skill: string) => {
    setAdding(skill);
    add.mutate(skill, {
      onSuccess: () => toast.show({ message: t('opportunity.missingSkills.added', { skill }) }),
      onSettled: () => setAdding(null),
    });
  };
  return (
    <Section title={t('opportunity.missingSkills.title')}>
      <Card>
        <p className="flex items-start gap-2 text-sm text-muted">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {t('opportunity.missingSkills.body')}
        </p>
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {skills.map((skill) => (
            <li key={skill} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="flex-1 font-semibold text-foreground">{skill}</span>
              <Button
                size="sm"
                variant="secondary"
                icon={adding === skill ? Check : Plus}
                loading={adding === skill}
                disabled={adding !== null}
                aria-label={t('opportunity.missingSkills.addLabel', { skill })}
                onClick={() => addSkill(skill)}
              >
                {t('opportunity.missingSkills.add')}
              </Button>
              <a
                href={learnHref(skill)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('opportunity.missingSkills.learnLabel', { skill })}
                className={buttonVariants({ size: 'sm', variant: 'ghost' })}
              >
                <BookOpen className="size-4" aria-hidden />
                {t('opportunity.missingSkills.learn')}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
