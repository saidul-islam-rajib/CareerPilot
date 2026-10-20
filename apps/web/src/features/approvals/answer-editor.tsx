'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { AnswerSource, type QuestionAnswer } from '@careerpilot/api-client';
import { useSchemas, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { validate } from '@careerpilot/validation';
import { Badge, Button, TextAreaField } from '@careerpilot/ui-web';

export function AnswerEditor({ item, editable, saving, onSave }: { item: QuestionAnswer; editable: boolean; saving: boolean; onSave: (answer: string) => void }) {
  const t = useT();
  const schemas = useSchemas();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.answer);
  const [error, setError] = useState<string>();

  const save = () => {
    const result = validate(schemas.answer, draft);
    if (!result.ok) {
      setError(result.errors.form);
      return;
    }
    onSave(result.value);
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-2 py-3">
      <p className="font-semibold">{item.question}</p>
      {item.source === AnswerSource.Ai ? <Badge label={t('approvals.aiDrafted')} tone={StatusTone.Warning} /> : null}
      {item.source === AnswerSource.Profile ? <Badge label={t('approvals.fromProfile')} tone={StatusTone.Info} /> : null}
      {editing ? (
        <>
          <TextAreaField label={t('approvals.editAnswer')} value={draft} onChange={(e) => setDraft(e.target.value)} error={error} autoFocus />
          <div className="flex gap-2">
            <Button onClick={save} loading={saving}>
              {t('common.save')}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-2">
          <p className="flex-1 whitespace-pre-wrap">{item.answer}</p>
          {editable ? (
            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
