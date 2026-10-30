'use client';

import { Fragment } from 'react';
import type { Profile } from '@careerpilot/api-client';
import { sortEntries, useProfileSettings, useT } from '@careerpilot/client-core';
import { ProfileFieldType } from '@careerpilot/domain-ui-logic';
import { Card } from '@careerpilot/ui-web';

type EntryValue = Profile['sections'][string][number]['values'][string];
type FieldDefinition = ReturnType<typeof useProfileSettings>['settings']['sections'][number]['fields'][number];

function present(value: EntryValue | undefined): value is string | number | boolean {
  return value !== undefined && value !== null && value !== '';
}

export function ProfileDetails({ profile }: { profile: Profile }) {
  const t = useT();
  const { settings, optionLabel } = useProfileSettings();
  const filled = settings.sections.filter((section) => (profile.sections[section.key]?.length ?? 0) > 0);
  const show = (field: FieldDefinition, value: string | number | boolean): string => {
    if (field.type === ProfileFieldType.Select && field.options) {
      return optionLabel(field.options, String(value));
    }
    if (field.type === ProfileFieldType.Boolean) {
      return value === true ? t('admin.records.yes') : t('admin.records.no');
    }
    return String(value);
  };
  return (
    <Card className="gap-4 xl:col-span-2">
      <h3 className="text-lg font-semibold">{t('admin.records.profileDetails')}</h3>
      {filled.length === 0 ? <p className="text-sm text-muted">{t('admin.records.noProfileDetails')}</p> : null}
      {filled.map((section) => (
        <section key={section.key} aria-label={t(`profile.sections.${section.key}.title`)} className="flex flex-col gap-2">
          <h4 className="font-semibold text-foreground">{t(`profile.sections.${section.key}.title`)}</h4>
          {sortEntries(profile.sections[section.key]).map((entry) => (
            <dl key={entry.id} className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-control bg-surface p-3 text-sm sm:grid-cols-[minmax(10rem,max-content)_1fr]">
              {section.fields.map((field) => {
                const value = entry.values[field.key];
                return present(value) ? (
                  <Fragment key={field.key}>
                    <dt className="text-muted">{t(`profile.fields.${section.key}.${field.key}`)}</dt>
                    <dd className="break-words text-foreground">{show(field, value)}</dd>
                  </Fragment>
                ) : null;
              })}
            </dl>
          ))}
        </section>
      ))}
    </Card>
  );
}
