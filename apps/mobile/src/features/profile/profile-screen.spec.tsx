import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockParams, mockRouter, renderWithProviders } from '@/test/render';
import { DocumentScreen } from './document-screen';
import { EntryScreen } from './entry-screen';
import { PhotoCropScreen } from './photo-crop-screen';
import { EditContactScreen, EditSkillsScreen } from './profile-edit-screens';
import { ProfileScreen } from './profile-screen';
import { VerifyContactScreen } from './verify-contact-screen';
import { ViewerScreen } from './viewer-screen';

const getDocument = DocumentPicker.getDocumentAsync as jest.Mock;
const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

describe('ProfileScreen', () => {
  it('shows every configured section with computed completeness', async () => {
    renderWithProviders(<ProfileScreen />);
    expect(await screen.findByText('Ayesha Rahman')).toBeTruthy();
    expect(screen.getByText(/Profile \d+% complete/)).toBeTruthy();
    expect(screen.getByText('BSc in Computer Science and Engineering')).toBeTruthy();
    expect(screen.getByText('React')).toBeTruthy();
    for (const title of ['About', 'Emails and phones', 'Experience', 'Education', 'Skills', 'Documents', 'Languages', 'Tests and scores', 'Referees']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('reorders contacts with the accessible move buttons', async () => {
    const { services } = renderWithProviders(<ProfileScreen />);
    fireEvent.press(await screen.findByLabelText('Move down: admin@sober.com'));
    await waitFor(async () => {
      const profile = await services.api.profile.getProfile();
      expect([...profile.contacts].sort((a, b) => a.position - b.position).map((c) => c.id).slice(0, 2)).toEqual(['c_phone_mobile', 'c_email_work']);
    });
  });

  it('opens editors for entries and contacts', async () => {
    renderWithProviders(<ProfileScreen />);
    fireEvent.press(await screen.findByLabelText('Frontend Engineer'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/profile/entry', params: { section: 'experience', id: 'ex_lumen' } });
    fireEvent.press(screen.getByLabelText('Edit: admin@sober.com'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/profile/contact', params: { id: 'c_email_work' } });
  });

  it('uploads a picked PDF and rejects other files', async () => {
    const { services } = renderWithProviders(<ProfileScreen />);
    getDocument.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///cache/Remote CV.pdf', name: 'Remote CV.pdf', mimeType: 'application/pdf', size: 2048 }] });
    fireEvent.press(await screen.findByLabelText('Upload PDF'));
    await waitFor(async () => expect((await services.api.profile.getProfile()).documents.map((d) => d.name)).toContain('Remote CV'));
    expect(await screen.findByText('Remote CV.pdf uploaded')).toBeTruthy();
    getDocument.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///cache/scan.png', name: 'scan.png', mimeType: 'image/png', size: 2048 }] });
    fireEvent.press(screen.getByLabelText('Upload PDF'));
    expect(await screen.findByText('Choose a PDF file.')).toBeTruthy();
  });

  it('changes the photo from the image library', async () => {
    const { services } = renderWithProviders(<ProfileScreen />);
    launchLibrary.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///cache/me.jpg', fileName: 'me.jpg', mimeType: 'image/jpeg', fileSize: 4096 }] });
    fireEvent.press(await screen.findByLabelText('Change photo'));
    await waitFor(async () => expect((await services.api.profile.getProfile()).photoUrl).toBe('file:///cache/me.jpg'));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/profile/photo'));
  });

  it('opens the photo viewer', async () => {
    renderWithProviders(<ProfileScreen />);
    fireEvent.press(await screen.findByLabelText('Photo. Tap to view and zoom'));
    expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/viewer' }));
  });
});

describe('profile editors', () => {
  it('validates and adds an experience entry', async () => {
    mockParams.current = { section: 'experience' };
    const { services } = renderWithProviders(<EntryScreen />);
    fireEvent.press(await screen.findByLabelText('Save'));
    expect(await screen.findByText('Please fix 3 highlighted fields.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Job title'), 'Staff Engineer');
    fireEvent.changeText(screen.getByLabelText('Company or organization'), 'Kite Commerce');
    fireEvent.changeText(screen.getByLabelText('Start'), '2025-01');
    fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect((await services.api.profile.getProfile()).sections.experience?.map((e) => e.values.title)).toContain('Staff Engineer'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('removes an entry and restores it with undo', async () => {
    mockParams.current = { section: 'tests', id: 'test_ielts' };
    const { services } = renderWithProviders(<EntryScreen />);
    fireEvent.press(await screen.findByLabelText('Remove'));
    await waitFor(async () => expect((await services.api.profile.getProfile()).sections.tests).toEqual([]));
    fireEvent.press(await screen.findByLabelText('Undo'));
    await waitFor(async () => expect((await services.api.profile.getProfile()).sections.tests?.map((e) => e.id)).toEqual(['test_ielts']));
  });

  it('makes another email primary from its editor', async () => {
    mockParams.current = { id: 'c_email_personal' };
    const { services } = renderWithProviders(<EditContactScreen />);
    fireEvent.press(await screen.findByLabelText('Make primary'));
    await waitFor(async () => {
      const profile = await services.api.profile.getProfile();
      expect(profile.contacts.find((c) => c.isPrimary && c.kind === 'email')?.id).toBe('c_email_personal');
    });
  });

  it('checks a new phone number before saving', async () => {
    const { services } = renderWithProviders(<EditContactScreen />);
    fireEvent.press(await screen.findByLabelText('Phone'));
    fireEvent.changeText(screen.getByLabelText('Phone number with country code'), 'call me');
    fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Enter a valid phone number with country code.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Phone number with country code'), '+8801900000000');
    fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect((await services.api.profile.getProfile()).contacts.some((c) => c.value === '+8801900000000')).toBe(true));
  });

  it('adds and removes skills', async () => {
    const { services } = renderWithProviders(<EditSkillsScreen />);
    fireEvent.changeText(await screen.findByLabelText('Add skill'), 'GraphQL');
    fireEvent(screen.getByLabelText('Add skill'), 'submitEditing');
    await waitFor(async () => expect((await services.api.profile.getProfile()).skills).toContain('GraphQL'));
    fireEvent.press(await screen.findByLabelText('Remove GraphQL'));
    await waitFor(async () => expect((await services.api.profile.getProfile()).skills).not.toContain('GraphQL'));
  });

  it('renames a document and lists its versions', async () => {
    mockParams.current = { id: 'doc_cv' };
    const { services } = renderWithProviders(<DocumentScreen />);
    expect(await screen.findByText(/Version 3 uploaded/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Document name'), 'Remote CV');
    fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(async () => expect((await services.api.profile.getProfile()).documents.find((d) => d.id === 'doc_cv')?.name).toBe('Remote CV'));
  });
});

describe('ViewerScreen', () => {
  it('offers zoom controls and closes', async () => {
    mockParams.current = { uri: 'data:image/png;base64,AAAA', title: 'Signature' };
    renderWithProviders(<ViewerScreen />);
    expect(await screen.findByLabelText('Zoom in')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Zoom in'));
    fireEvent.press(screen.getByLabelText('Reset zoom'));
    fireEvent.press(screen.getByLabelText('Close'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('PhotoCropScreen', () => {
  it('zooms in on the face and saves what the circle shows', async () => {
    const { services } = renderWithProviders(<PhotoCropScreen />);
    fireEvent(await screen.findByTestId('photo-crop-image'), 'load', { nativeEvent: { source: { width: 600, height: 1200 } } });
    for (let step = 0; step < 12; step += 1) {
      fireEvent.press(screen.getByTestId('photo-zoom-in'));
    }
    fireEvent.press(screen.getByLabelText('Move photo down'));
    fireEvent.press(screen.getByTestId('photo-crop-save'));
    await waitFor(async () => expect((await services.api.profile.getProfile()).photoCrop).toEqual({ x: 0.375, y: 0.4275, width: 0.25, height: 0.125 }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });
});

describe('VerifyContactScreen', () => {
  it('sends a code and verifies the email', async () => {
    mockParams.current = { id: 'c_email_personal' };
    const { services } = renderWithProviders(<VerifyContactScreen />);
    expect(await screen.findByText(/We'll email a 6-digit code to ayesha.personal@example.com/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('verification-send'));
    expect(await screen.findByText(/We sent a 6-digit code to a•••@example.com/)).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('verification-code'), '000000');
    fireEvent.press(screen.getByTestId('verification-submit'));
    expect(await screen.findByText("That code isn't right. Check it and try again.")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('verification-code'), '246810');
    fireEvent.press(screen.getByTestId('verification-submit'));
    await waitFor(async () => expect((await services.api.profile.getProfile()).contacts.find((c) => c.id === 'c_email_personal')?.verified).toBe(true));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('offers verification only on unverified email contacts', async () => {
    renderWithProviders(<ProfileScreen />);
    fireEvent.press(await screen.findByLabelText('Verify ayesha.personal@example.com'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/profile/verify-contact', params: { id: 'c_email_personal' } });
    expect(screen.queryByLabelText('Verify admin@sober.com')).toBeNull();
  });
});
