import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import type { FillPlan } from '@careerpilot/api-client';
import { HostPolicy } from '@careerpilot/domain-ui-logic';
import { AssistCvState, buildAssistScript, cvCommand, parseAssistMessage, passwordCommand, toBase64 } from './script';

const plan: FillPlan = {
  applicationId: 'a1',
  officialUrl: 'https://jobs.example.com',
  host: 'jobs.example.com',
  hostPolicy: HostPolicy.Review,
  assistAllowed: true,
  accountEmail: 'account@example.com',
  hasPassword: true,
  facts: [
    { fact: 'full_name', value: 'Rahim Uddin', autocomplete: ['name'], names: ['full_name'], labels: ['full name'] },
    { fact: 'email', value: 'rahim@example.com', autocomplete: ['email'], names: ['email'], labels: ['email'] },
  ],
  answers: [{ label: 'Years of experience', answer: '5' }],
  coverLetter: '',
  coverLetterLabels: ['cover letter'],
  resumeLabels: ['resume', 'cv'],
  confirmationPhrases: ['thank you for applying'],
  skipTerms: ['certify', 'gender'],
  captchaSelectors: ['iframe[src*="recaptcha"]', '.g-recaptcha'],
  scanIntervalMs: 50,
  excerptChars: 100,
};

const messages: string[] = [];
let dom: JSDOM;

function run(script: string) {
  dom.window.eval(script);
}

function mount(html: string) {
  dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', url: 'https://jobs.example.com/apply' });
  messages.length = 0;
  Object.assign(dom.window, { ReactNativeWebView: { postMessage: (m: string) => messages.push(m) } });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'getClientRects', { configurable: true, value: () => [{}] });
  run(buildAssistScript(plan));
}

function byId(id: string) {
  return dom.window.document.getElementById(id) as HTMLInputElement;
}

  return parseAssistMessage(messages[messages.length - 1] ?? '');
  return parseAssistMessage(messages[messages.length - 1]);
}

const FORM = `
  <form>
    <label for="n">Full name</label><input id="n" name="full_name" />
    <label for="y">Years of experience</label><input id="y" />
    <label for="g">Gender</label><input id="g" />
    <label for="c">I certify this is true</label><input id="c" type="checkbox" />
    <label for="q">Favourite colour</label><input id="q" />
    <label for="p">Already filled</label><input id="p" value="keep" name="full_name" />
    <div class="g-recaptcha"><input id="cap" /></div>
    <button id="submit" type="submit">Submit</button>
  </form>`;

describe('assist script', () => {
  it('fills matching empty inputs and lists the rest for the user', () => {
    mount(FORM);
    expect(byId('n').value).toBe('Rahim Uddin');
    expect(byId('y').value).toBe('5');
    expect(byId('p').value).toBe('keep');
    const status = lastStatus();
    expect(status?.filled).toBe(2);
    const labels = status?.left.map((item) => item.label);
    expect(labels).toEqual(expect.arrayContaining(['Gender', 'I certify this is true', 'Favourite colour']));
  });

  it('leaves declarations, demographic questions and captcha widgets untouched and never submits', () => {
    const clicked = vi.fn();
    mount(FORM);
    byId('submit').addEventListener('click', clicked);
    run(buildAssistScript(plan));
    expect(byId('g').value).toBe('');
    expect(byId('c').checked).toBe(false);
    expect(byId('cap').value).toBe('');
    expect(clicked).not.toHaveBeenCalled();
    expect(lastStatus()?.left.find((item) => item.label === 'Gender')?.kind).toBe('protected');
  });

  it('uses the account email on a sign-in form and the password only when told', () => {
    mount('<form><label for="e">Email</label><input id="e" type="email" name="email" /><input id="pw" type="password" /></form>');
    expect(byId('e').value).toBe('account@example.com');
    expect(byId('pw').value).toBe('');
    run(passwordCommand('s3cret'));
    expect(byId('pw').value).toBe('s3cret');
  });

  it('asks the user to pick the CV when it cannot be attached and reports a confirmation phrase', () => {
    mount('<p>Thank you for applying to Acme</p><label for="f">Resume</label><input id="f" type="file" />');
    expect(lastStatus()?.cv).toBe(AssistCvState.Pick);
    expect(lastStatus()?.confirmation).toContain('Thank you for applying');
  });

  it('builds safe commands and parses status messages', () => {
    expect(cvCommand('cv.pdf', 'application/pdf', 'QUJD')).toContain('setCv("cv.pdf"');
    expect(toBase64(new Uint8Array([65, 66, 67]))).toBe('QUJD');
    expect(parseAssistMessage('nope')).toBeNull();
    expect(parseAssistMessage(JSON.stringify({ type: 'other' }))).toBeNull();
  });
});
