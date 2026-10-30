import { describe, expect, it } from 'vitest';
import { MessageKind } from '@careerpilot/domain-ui-logic';
import { ApiErrorDetail, isApiError } from '../errors';
import { createTestApi } from '../test-support';

describe('in-memory messaging replies', () => {
  it('quotes the message a reply answers', async () => {
    const api = createTestApi();
    const [question] = (await api.messaging.messages('cnv_karim')).messages;
    const reply = await api.messaging.sendText('cnv_karim', 'Yes, very interested', question?.id);
    expect(reply.replyTo).toEqual({ id: question?.id, kind: MessageKind.Text, senderName: 'Karim Hasan', fromMe: false, text: question?.text });
    const answered = (await api.messaging.messages('cnv_karim')).messages.at(-1);
    expect(answered?.replyTo?.id).toBe(question?.id);
    const second = await api.messaging.sendText('cnv_karim', 'Here is my CV', reply.id);
    expect(second.replyTo).toMatchObject({ id: reply.id, fromMe: true, text: 'Yes, very interested' });
  });

  it('refuses a reply to a message from another chat', async () => {
    const api = createTestApi();
    const [question] = (await api.messaging.messages('cnv_karim')).messages;
    const team = await api.messaging.team();
    const error = await api.messaging.sendText(team.id, 'Hello', question?.id).catch((e: unknown) => e);
    expect(isApiError(error) ? error.detail : undefined).toBe(ApiErrorDetail.ReplyTo);
  });
});
