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

    it('should simulate linear de-induction during smoking cessation over 14 days', () => {
        // Gün 0: sigara içici seviyesi
        const day0 = pk.calculateEffectiveHalfLife(0, true, 0, 20, false);
        // 1 + (0.04 * 20) = 1.8 -> 5.0 / 1.8 = 2.77
        expect(day0).toBeCloseTo(2.78, 2);

        // Gün 7: yarı yol
        const day7 = pk.calculateEffectiveHalfLife(0, true, 7, 20, false);
        expect(day7).toBeGreaterThan(day0);
        expect(day7).toBeLessThan(5.0);

        // Gün 14: baz seviyeye (5.0 sa) dönüş
        const day14 = pk.calculateEffectiveHalfLife(0, true, 14, 20, false);
        expect(day14).toBe(5.0);
    });

    it('should handle Bateman kinetics and boundary conditions', () => {
        // Negatif saat geçişi kontrolü
        expect(pk.calculateCaffeineAtTime(100, -1, 5.0)).toBe(0);

        // Aç vs Tok karnına emilim hızı farkı
        // 0.5 saat sonra aç karnına emilim tok karnına göre daha yüksek olmalı
        const emptyStomach = pk.calculateCaffeineAtTime(100, 0.5, 5.0, 'empty');
        const fullStomach = pk.calculateCaffeineAtTime(100, 0.5, 5.0, 'full');
        expect(emptyStomach).toBeGreaterThan(fullStomach);

        // Singularity guard testi: ka == ke
        // ke = ln(2)/5.0 = 0.1386. Eğer ka == ke olursa formül çökmemeli
        const customHalfLife = Math.LN2 / 5.0; // ke = 5.0 = ka
        const singularityVal = pk.calculateCaffeineAtTime(100, 1.0, customHalfLife, 'empty');
        expect(singularityVal).toBeGreaterThan(0);
        expect(Number.isFinite(singularityVal)).toBe(true);
    });

    it('should calculate total active caffeine for a history', () => {
        const history: DrinkRecord[] = [
            { id: 1, name: 'Espresso', caffeineMg: 100, timestamp: Date.now() - (2 * 60 * 60 * 1000) } // 2 hours ago
        ];
        
        const activeCaffeine = pk.getTotalActiveCaffeine(history, Date.now());
        expect(activeCaffeine).toBeGreaterThan(0);
        expect(activeCaffeine).toBeLessThan(100);
    });

    it('should estimate time to safe sleep threshold correctly', () => {
        const now = Date.now();
        // Geçmişte tüketim yoksa hemen uyuyabilir
        expect(pk.estimateTimeToThreshold([], 20)).toBe(now);

        // 200 mg kafein yeni alındıysa uyku zamanı gelecekte olmalı
        const history: DrinkRecord[] = [
            { id: 1, name: 'Double Espresso', caffeineMg: 200, timestamp: now }
        ];
        const sleepTime = pk.estimateTimeToThreshold(history, 20);
        expect(sleepTime).toBeGreaterThan(now);
    });
});
