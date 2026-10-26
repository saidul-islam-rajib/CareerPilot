import { ApiErrorCode, ApiErrorDetail } from '../errors';
import type { IdGenerator } from '../ports';
import {
  AccountLinkPurpose,
  type AccountLinkDetails,
  type CompleteAccountLinkRequest,
  type PublicConfig,
  type RegisterRequest,
  type Session,
} from '../types';
import type { DemoAccount } from './demo.seed';

export interface AccountLinkOptions {
  accounts: DemoAccount[];
  config: PublicConfig;
  demoLinkToken: string;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  reject: (code: ApiErrorCode, detail?: string) => Promise<never>;
  onSignIn: (userId: string) => void;
}

const normalize = (email: string) => email.trim().toLowerCase();

export function createAccountLinks(options: AccountLinkOptions) {
  const { accounts, ids, respond, reject } = options;
  let linkedUserId: string | undefined;
  const find = (email: string) => accounts.find((a) => normalize(a.user.email) === normalize(email));
  const linked = (token: string) => (token === options.demoLinkToken ? accounts.find((a) => a.user.id === linkedUserId) : undefined);

  return {
    register(request: RegisterRequest): Promise<void> {
      if (!request.consent) {
        return reject(ApiErrorCode.Validation, 'consent');
      }
      const existing = find(request.email);
      if (existing && !existing.registered) {
        return respond(undefined);
      }
      const account = existing ?? { user: { id: ids.next('usr'), fullName: '', email: normalize(request.email) }, password: '', registered: true };
      account.user.fullName = request.fullName.trim();
      if (!existing) {
        accounts.push(account);
      }
      linkedUserId = account.user.id;
      return respond(undefined);
    },
    requestPasswordReset(email: string): Promise<void> {
      linkedUserId = find(email)?.user.id ?? linkedUserId;
      return respond(undefined);
    },
    inspect(token: string): Promise<AccountLinkDetails> {
      const account = linked(token);
      if (!account) {
        return reject(ApiErrorCode.Validation, ApiErrorDetail.LinkInvalid);
      }
      const purpose = account.registered ? AccountLinkPurpose.Setup : AccountLinkPurpose.Reset;
      return respond({ purpose, fullName: account.user.fullName, email: account.user.email });
    },
    complete(request: CompleteAccountLinkRequest): Promise<Session> {
      const account = linked(request.token);
      if (!account) {
        return reject(ApiErrorCode.Validation, ApiErrorDetail.LinkExpired);
      }
      if (request.password.length < options.config.validationPolicy.password.minLength) {
        return reject(ApiErrorCode.Validation, 'password');
      }
      account.password = request.password;
      account.registered = false;
      linkedUserId = undefined;
      options.onSignIn(account.user.id);
      return respond({ accessToken: ids.next('token'), user: account.user });
    },
  };
}
