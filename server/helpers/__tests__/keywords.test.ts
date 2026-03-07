import { describe, it, expect } from 'vitest';
import { correctTypos, correctQueryPhonetic, findClosestKeyword } from '../keywords';

describe('correctTypos', () => {
  it('does NOT correct "dental" to "mental"', () => {
    const { corrected } = correctTypos('dental services');
    expect(corrected).toContain('dental');
    expect(corrected).not.toContain('mental');
  });

  it('does NOT correct "rental" to "mental"', () => {
    const { corrected } = correctTypos('rental assistance');
    expect(corrected).toContain('rental');
  });

  it('does NOT correct "hopeless" to "homeless"', () => {
    const { corrected } = correctTypos('feeling hopeless');
    expect(corrected).toContain('hopeless');
  });

  it('corrects "addicton" to "addiction"', () => {
    const { corrected, corrections } = correctTypos('addicton help');
    expect(corrected).toContain('addiction');
    expect(corrections.length).toBe(1);
  });

  it('corrects "councelling" to "counselling"', () => {
    const { corrected } = correctTypos('councelling near me');
    expect(corrected).toContain('counselling');
  });

  it('corrects "sheltar" to "shelter"', () => {
    const { corrected } = correctTypos('sheltar tonight');
    expect(corrected).toContain('shelter');
  });

  it('corrects "anxeity" to "anxiety"', () => {
    const { corrected } = correctTypos('anxeity treatment');
    expect(corrected).toContain('anxiety');
  });

  it('does not modify already correct words', () => {
    const { corrected, corrections } = correctTypos('addiction counselling shelter');
    expect(corrected).toBe('addiction counselling shelter');
    expect(corrections.length).toBe(0);
  });

  it('skips words shorter than 4 chars', () => {
    const { corrected } = correctTypos('I am sad');
    expect(corrected).toBe('i am sad');
  });
});

describe('correctQueryPhonetic', () => {
  it('corrects "fud bank" to "food bank"', () => {
    const { corrected } = correctQueryPhonetic('fud bank');
    expect(corrected).toContain('food');
  });

  it('corrects "sheltr" to "shelter"', () => {
    const { corrected } = correctQueryPhonetic('sheltr tonight');
    expect(corrected).toContain('shelter');
  });

  it('does not alter correct words', () => {
    const { corrected, corrections } = correctQueryPhonetic('food bank');
    expect(corrected).toBe('food bank');
    expect(corrections.length).toBe(0);
  });
});

describe('findClosestKeyword', () => {
  it('does NOT match "dental" to "mental"', () => {
    const match = findClosestKeyword('dental');
    expect(match).not.toBe('mental');
  });
});
