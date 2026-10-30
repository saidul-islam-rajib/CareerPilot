import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { renderWithProviders } from '@/test/render';
import { VoicePlayer } from './voice';

describe('VoicePlayer', () => {
  it('plays through the speaker even when the phone is on silent', async () => {
    await renderWithProviders(<VoicePlayer url="https://files.test/voice.m4a" durationSeconds={4} tint="#000" />, { signedIn: true });
    await fireEvent.press(await screen.findByLabelText('Play voice message'));
    expect(setAudioModeAsync).toHaveBeenCalledWith({ allowsRecording: false, playsInSilentMode: true });
    await waitFor(() => expect(useAudioPlayer('').play).toHaveBeenCalled());
  });
});
