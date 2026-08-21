import { describe, it, expect, beforeEach } from 'vitest';
import { Pharmacokinetics } from '../src/engine/Pharmacokinetics';
import { DrinkRecord } from '../src/store/db';

describe('Pharmacokinetics Engine', () => {
    let pk: Pharmacokinetics;

    beforeEach(() => {
        pk = new Pharmacokinetics();
    });

    it('should initialize with default baseHalfLife', () => {
        expect(pk.baseHalfLife).toBe(5.0);
    });

    it('should calculate effective half-life for non-smoker', () => {
        const halfLife = pk.calculateEffectiveHalfLife(0, false, 0, 20, false);
        expect(halfLife).toBe(5.0);
    });

    it('should calculate effective half-life for heavy smoker (30 cigs/day)', () => {
        const halfLife = pk.calculateEffectiveHalfLife(30, false, 0, 20, false);
        // 1 + (0.04 * 30) = 2.2 factor
        // 5.0 / 2.2 = 2.27...
        expect(halfLife).toBeCloseTo(2.27, 2);
    });

    it('should calculate effective half-life with OCP (Oral Contraceptive)', () => {
        const halfLife = pk.calculateEffectiveHalfLife(0, false, 0, 20, true);
        // 5.0 * 2.0 = 10.0
        expect(halfLife).toBe(10.0);
    });

    it('should calculate total active caffeine for a history', () => {
        const history: DrinkRecord[] = [
            { id: 1, name: 'Espresso', caffeineMg: 100, timestamp: Date.now() - (2 * 60 * 60 * 1000) } // 2 hours ago
        ];
        
        // Bateman peak is around 30-45 mins. At 2 hours, it should be decreasing.
        const activeCaffeine = pk.getTotalActiveCaffeine(history, Date.now());
        expect(activeCaffeine).toBeGreaterThan(0);
        expect(activeCaffeine).toBeLessThan(100);
    });
});
