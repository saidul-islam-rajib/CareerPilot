import { fireEvent, screen, waitFor } from '@testing-library/react';
import { ApiError, ApiErrorCode } from '@careerpilot/api-client';
import { TEST_LINK_TOKEN } from '@careerpilot/client-core/src/testing';
import { renderAdmin } from '@/test/render';
import { SignInPage } from '@/features/auth/sign-in-page';
import { useReauth } from './reauth-provider';
import { SecurityPage } from './security-page';

const ADMIN_EMAIL = 'admin@sober.com';

async function enrol(services: { api: { auth: { beginMfaEnrolment(): Promise<unknown>; confirmMfa(code: string): Promise<unknown> } } }) {
  await services.api.auth.beginMfaEnrolment();
  await services.api.auth.confirmMfa(TEST_LINK_TOKEN);
}

function Guarded({ action }: { action: () => Promise<string> }) {
  const reauth = useReauth();
  return (
    <button type="button" onClick={() => void reauth.run(action).then((value) => document.title = value)}>
      Run guarded
    </button>
  );
}

describe('admin two-factor security', () => {
  it('enrols, shows the secret, confirms a code and shows recovery codes once', async () => {
    await renderAdmin(<SecurityPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator' }));
    expect(await screen.findByLabelText('Secret key')).toHaveValue(TEST_LINK_TOKEN);
    fireEvent.change(screen.getAllByLabelText('Authentication code')[0]!, { target: { value: TEST_LINK_TOKEN } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and turn on' }));
    expect(await screen.findByTestId('recovery-codes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I have saved my codes' }));
    expect(screen.queryByTestId('recovery-codes')).not.toBeInTheDocument();
  });

  it('rejects a wrong confirmation code', async () => {
    await renderAdmin(<SecurityPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Set up authenticator' }));
    await screen.findByLabelText('Secret key');
    fireEvent.change(screen.getAllByLabelText('Authentication code')[0]!, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and turn on' }));
    expect(await screen.findByText('That code was not accepted. Check the code and try again.')).toBeInTheDocument();
  });

  it('asks for the code on sign-in when the API requires it', async () => {
    await renderAdmin(<SignInPage />, { signedIn: false, prepare: async (services) => {
      await services.api.auth.signIn({ email: ADMIN_EMAIL, password: ADMIN_EMAIL });
      await enrol(services);
    } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: ADMIN_EMAIL } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: ADMIN_EMAIL } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByLabelText('Authentication code')).toBeInTheDocument();
  });

  it('opens the re-auth dialog, then retries the action with a proof', async () => {
    const action = vi.fn().mockRejectedValueOnce(new ApiError(ApiErrorCode.ReauthRequired, 403)).mockResolvedValue('done');
    const { services } = await renderAdmin(<Guarded action={action} />, { prepare: enrol });
    fireEvent.click(screen.getByRole('button', { name: 'Run guarded' }));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: ADMIN_EMAIL } });
    fireEvent.change(screen.getByLabelText('Authentication code'), { target: { value: TEST_LINK_TOKEN } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and continue' }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(services.tokens.reauthToken).toBeTruthy();
  });

  it('shows an error when the re-auth details are wrong', async () => {
    const action = vi.fn().mockRejectedValue(new ApiError(ApiErrorCode.ReauthRequired, 403));
    await renderAdmin(<Guarded action={action} />, { prepare: enrol });
    fireEvent.click(screen.getByRole('button', { name: 'Run guarded' }));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.change(screen.getByLabelText('Authentication code'), { target: { value: TEST_LINK_TOKEN } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and continue' }));
    expect(await screen.findByText('Confirmation failed. Check your password and code.')).toBeInTheDocument();
  });
});
