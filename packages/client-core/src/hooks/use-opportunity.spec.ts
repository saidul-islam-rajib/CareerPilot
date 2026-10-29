import { describe, expect, it } from 'vitest';
import { learnSkillHref } from './use-opportunity';

describe('learnSkillHref', () => {
  it('puts the encoded skill name into the configured address', () => {
    expect(learnSkillHref('https://www.example.com/search?q=learn+{skill}', 'C++ & C#')).toBe('https://www.example.com/search?q=learn+C%2B%2B%20%26%20C%23');
  });
});
