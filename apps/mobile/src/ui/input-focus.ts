import { useState } from 'react';
import type { TextStyle } from 'react-native';

export const bareInput: TextStyle = { outlineWidth: 0 };

export function useInputFocus() {
  const [focused, setFocused] = useState(false);
  return { focused, onFocus: () => setFocused(true), onBlur: () => setFocused(false) };
}
