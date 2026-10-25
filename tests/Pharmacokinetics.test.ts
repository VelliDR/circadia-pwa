import { describe, it, expect, beforeEach } from 'vitest';
import { Pharmacokinetics, CAFFEINE_VD_L_PER_KG } from '../src/engine/Pharmacokinetics';
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
        // 1 + (0.04 * 30) = 2.2 factor -> 5.0 / 2.2 = 2.27...
        expect(halfLife).toBeCloseTo(2.27, 2);
    });

    it('should calculate effective half-life with OCP and pregnancy inhibition', () => {
        expect(pk.calculateEffectiveHalfLife(0, false, 0, 20, true, false)).toBe(10.0);
        expect(pk.calculateEffectiveHalfLife(0, false, 0, 20, false, true)).toBe(10.0);
        // Max physiological safety cap = 18.0 h
        const extreme = new Pharmacokinetics(10.0);
        expect(extreme.calculateEffectiveHalfLife(0, false, 0, 20, true, true)).toBe(18.0);
    });

    it('should simulate exponential CYP1A2 de-induction during smoking cessation over 14 days', () => {
        // Gün 0: sigara içici seviyesi (5.0 / 1.8 = 2.78 sa)
        const day0 = pk.calculateEffectiveHalfLife(0, true, 0, 20, false);
        expect(day0).toBeCloseTo(2.78, 2);

        // Gün 3.5: üstel sönümlenme (τ = 2.3 gün) nedeniyle doğrusal orta noktadan (~3.89 sa) daha hızlı toparlanmalı
        const day3_5 = pk.calculateEffectiveHalfLife(0, true, 3.5, 20, false);
        expect(day3_5).toBeGreaterThan((day0 + 5.0) / 2);

        // Gün 7: baz seviyeye yaklaşmış ancak henüz 5.0 olmamış
        const day7 = pk.calculateEffectiveHalfLife(0, true, 7, 20, false);
        expect(day7).toBeGreaterThan(day3_5);
        expect(day7).toBeLessThan(5.0);

        // Gün 14: baz seviyeye (5.0 sa) tam dönüş
        const day14 = pk.calculateEffectiveHalfLife(0, true, 14, 20, false);
        expect(day14).toBe(5.0);
    });

    it('should compute analytical tmax (~44 min fasting vs ~86 min fed)', () => {
        const tmaxEmpty = pk.getTmaxMinutes(5.0, 'empty');
        const tmaxFull = pk.getTmaxMinutes(5.0, 'full');
        expect(tmaxEmpty).toBeCloseTo(44.3, 0);
        expect(tmaxFull).toBeCloseTo(86.1, 0);
        expect(tmaxFull).toBeGreaterThan(tmaxEmpty);
    });

    it('should compute plasma concentration from active body load and Vd', () => {
        // 91 mg active load / (0.65 L/kg * 70 kg = 45.5 L) = 2.0 mg/L
        const cp = pk.calculatePlasmaConcentrationMgL(91, 70, CAFFEINE_VD_L_PER_KG);
        expect(cp).toBeCloseTo(2.0, 3);
        expect(pk.calculatePlasmaConcentrationMgL(0, 70)).toBe(0);
    });

    it('should handle Bateman kinetics, 0 mg herbal drinks, and boundary conditions', () => {
        expect(pk.calculateCaffeineAtTime(100, -1, 5.0)).toBe(0);
        expect(pk.calculateCaffeineAtTime(0, 1, 5.0)).toBe(0);

        const emptyStomach = pk.calculateCaffeineAtTime(100, 0.5, 5.0, 'empty');
        const fullStomach = pk.calculateCaffeineAtTime(100, 0.5, 5.0, 'full');
        expect(emptyStomach).toBeGreaterThan(fullStomach);

        // Singularity guard testi: ka == ke
        const customHalfLife = Math.LN2 / 5.0;
        const singularityVal = pk.calculateCaffeineAtTime(100, 1.0, customHalfLife, 'empty');
        expect(singularityVal).toBeGreaterThan(0);
        expect(Number.isFinite(singularityVal)).toBe(true);
    });

    it('should calculate total active caffeine and preserve per-record effectiveHalfLife snapshot', () => {
        const now = Date.now();
        const history: DrinkRecord[] = [
            { id: 1, name: 'Espresso', caffeineMg: 100, timestamp: now - (4 * 60 * 60 * 1000), effectiveHalfLife: 5.0 },
            { id: 2, name: 'Nane Çayı', caffeineMg: 0, timestamp: now - (30 * 60 * 1000), effectiveHalfLife: 5.0 }
        ];

        const activeNonSmoker = pk.getTotalActiveCaffeine(history, now, 0);
        const activeChangedToSmoker = pk.getTotalActiveCaffeine(history, now, 25);
        // Kayıt üzerinde effectiveHalfLife (5.0) saklandığı için geçmiş eğri bozulmamalı
        expect(activeNonSmoker).toBeCloseTo(activeChangedToSmoker, 5);
        expect(activeNonSmoker).toBeGreaterThan(0);
        expect(activeNonSmoker).toBeLessThan(100);
    });

    it('should estimate time to safe sleep threshold correctly', () => {
        const now = Date.now();
        expect(pk.estimateTimeToThreshold([], 25, 0, false, 0, 20, false, false, now)).toBe(now);

        const history: DrinkRecord[] = [
            { id: 1, name: 'Double Espresso', caffeineMg: 128, timestamp: now }
        ];
        const sleepTime = pk.estimateTimeToThreshold(history, 25, 0, false, 0, 20, false, false, now);
        expect(sleepTime).toBeGreaterThan(now);
    });
});
