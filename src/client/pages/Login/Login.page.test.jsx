import { describe, it, expect } from 'vitest';
import { typewriterStep, TOPICS } from './Login.page.jsx';

describe('typewriterStep', () => {
  it('avanza un carácter mientras escribe', () => {
    const next = typewriterStep({ displayText: 'ed', isDeleting: false, topicIndex: 0 }, TOPICS);
    expect(next.displayText).toBe('edu');
    expect(next.isDeleting).toBe(false);
    expect(next.topicIndex).toBe(0);
  });

  it('señala done cuando la palabra está completa', () => {
    const word = TOPICS[0]; // 'educación'
    const next = typewriterStep({ displayText: word, isDeleting: false, topicIndex: 0 }, TOPICS);
    expect(next.done).toBe(true);
    expect(next.displayText).toBe(word);
  });

  it('borra un carácter mientras elimina', () => {
    const next = typewriterStep({ displayText: 'ed', isDeleting: true, topicIndex: 0 }, TOPICS);
    expect(next.displayText).toBe('e');
    expect(next.isDeleting).toBe(true);
  });

  it('avanza al siguiente tema cuando displayText queda vacío', () => {
    const next = typewriterStep({ displayText: '', isDeleting: true, topicIndex: 0 }, TOPICS);
    expect(next.topicIndex).toBe(1);
    expect(next.isDeleting).toBe(false);
    expect(next.displayText).toBe('');
  });

  it('cicla al primer tema desde el último', () => {
    const last = TOPICS.length - 1;
    const next = typewriterStep({ displayText: '', isDeleting: true, topicIndex: last }, TOPICS);
    expect(next.topicIndex).toBe(0);
  });
});
