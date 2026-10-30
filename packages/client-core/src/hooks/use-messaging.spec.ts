import { describe, expect, it } from 'vitest';
import type { MessageView, ReplyPreview } from '@careerpilot/api-client';
import { catalogs, createTranslator } from '@careerpilot/i18n';
import { MessageKind } from '@careerpilot/domain-ui-logic';
import { quoteSender, quoteText, replyPreviewOf } from './use-messaging';

const t = createTranslator(catalogs.en);
const QUOTE: ReplyPreview = { id: 'msg_1', kind: MessageKind.Text, senderName: 'Karim Hasan', fromMe: false, text: 'Are you hiring?' };

describe('reply quotes', () => {
  it('names the sender, or You for my own message', () => {
    expect(quoteSender(QUOTE, t)).toBe('Karim Hasan');
    expect(quoteSender({ ...QUOTE, fromMe: true }, t)).toBe('You');
  });

  it('shows the text, or what kind of attachment it was', () => {
    expect(quoteText(QUOTE, t)).toBe('Are you hiring?');
    expect(quoteText({ ...QUOTE, kind: MessageKind.Image, text: 'Photo' }, t)).toBe('Photo');
    expect(quoteText({ ...QUOTE, kind: MessageKind.Voice, text: '' }, t)).toBe('Voice message');
    expect(quoteText({ ...QUOTE, kind: MessageKind.File, text: 'cv.pdf' }, t)).toBe('cv.pdf');
  });

  it('turns a chosen message into the quote shown above the composer', () => {
    const message: MessageView = {
      id: 'msg_2',
      conversationId: 'cnv_1',
      kind: MessageKind.File,
      text: '',
      attachment: { url: 'https://files.example.org/cv.pdf', fileName: 'cv.pdf', contentType: 'application/pdf', sizeBytes: 10 },
      fromMe: true,
      senderName: 'Ayesha Rahman',
      createdAt: '2026-10-30T06:00:00.000Z',
    };
    expect(replyPreviewOf(message)).toEqual({ id: 'msg_2', kind: MessageKind.File, senderName: 'Ayesha Rahman', fromMe: true, text: 'cv.pdf' });
  });
});
