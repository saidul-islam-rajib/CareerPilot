import { useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAddMissingSkill, useLearnSkillHref, useT } from '@careerpilot/client-core';
import { BookOpen, Plus, Sparkles } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, Card, Icon, IconSize, Row, Section, Text, TextTone, TextVariant, useSnackbar } from '@/ui';

export function SkillChips({ skills }: { skills: string[] }) {
  const t = useT();
  const theme = useTheme();
  if (skills.length === 0) {
    return null;
  }
  return (
    <Row wrap gap={theme.space.xs}>
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {t('opportunity.skillsToAdd')}
      </Text>
      {skills.map((skill) => (
        <View
          key={skill}
          style={{
            paddingHorizontal: theme.space.sm,
            paddingVertical: theme.space.xxs,
            borderRadius: theme.radius.pill,
            borderWidth: theme.borderWidth.hairline,
            borderStyle: 'dashed',
            borderColor: theme.colors.input,
          }}
        >
          <Text variant={TextVariant.Caption}>{skill}</Text>
        </View>
      ))}
    </Row>
  );
}

export function MissingSkills({ opportunityId, skills }: { opportunityId: string; skills: string[] }) {
  const t = useT();
  const theme = useTheme();
  const snackbar = useSnackbar();
  const learnHref = useLearnSkillHref();
  const add = useAddMissingSkill(opportunityId);
  const [adding, setAdding] = useState<string | null>(null);
  if (skills.length === 0) {
    return null;
  }
  const addSkill = (skill: string) => {
    setAdding(skill);
    add.mutate(skill, {
      onSuccess: () => snackbar.show({ message: t('opportunity.missingSkills.added', { skill }) }),
      onSettled: () => setAdding(null),
    });
  };
  return (
    <Section title={t('opportunity.missingSkills.title')}>
      <Card>
        <Row align="flex-start">
          <Icon icon={Sparkles} size={IconSize.Small} color={theme.colors.primary} />
          <Text variant={TextVariant.Label} tone={TextTone.Muted} style={{ flex: 1 }}>
            {t('opportunity.missingSkills.body')}
          </Text>
        </Row>
        {skills.map((skill) => (
          <View key={skill} style={{ gap: theme.space.xs, paddingTop: theme.space.sm, borderTopWidth: theme.borderWidth.hairline, borderTopColor: theme.colors.border }}>
            <Text variant={TextVariant.Subheading}>{skill}</Text>
            <Row>
              <Button
                label={t('opportunity.missingSkills.add')}
                accessibilityLabel={t('opportunity.missingSkills.addLabel', { skill })}
                icon={Plus}
                variant={ButtonVariant.Secondary}
                loading={adding === skill}
                disabled={adding !== null}
                style={{ flex: 1 }}
                onPress={() => addSkill(skill)}
                testID={`add-skill-${skill}`}
              />
              <Button
                label={t('opportunity.missingSkills.learn')}
                accessibilityLabel={t('opportunity.missingSkills.learnLabel', { skill })}
                icon={BookOpen}
                variant={ButtonVariant.Ghost}
                style={{ flex: 1 }}
                onPress={() => void WebBrowser.openBrowserAsync(learnHref(skill))}
              />
            </Row>
          </View>
        ))}
      </Card>
    </Section>
  );
}
