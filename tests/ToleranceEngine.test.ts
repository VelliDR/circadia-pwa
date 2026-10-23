import { describe, it, expect, beforeEach } from 'vitest';
import { ToleranceEngine, TOLERANCE_LEVELS } from '../src/engine/ToleranceEngine';

describe('Tolerance Engine', () => {
    let tolerance: ToleranceEngine;

    beforeEach(() => {
        tolerance = new ToleranceEngine('MEDIUM');
    });

    it('should initialize with MEDIUM tolerance by default', () => {
        const t = new ToleranceEngine();
        expect(t.currentTolerance.id).toBe('MEDIUM');
        expect(t.currentTolerance.sleepThresholdMg).toBe(25);
    });

    it('should update tolerance level and sleep thresholds', () => {
        tolerance.setTolerance('HIGH');
        expect(tolerance.currentTolerance.id).toBe('HIGH');
        expect(tolerance.currentTolerance.thresholdMg).toBe(85);
        expect(tolerance.currentTolerance.sleepThresholdMg).toBe(40);

        tolerance.setTolerance('LOW');
        expect(tolerance.currentTolerance.id).toBe('LOW');
        expect(tolerance.currentTolerance.sleepThresholdMg).toBe(15);
    });

    it('should determine stimulation status', () => {
        const status1 = tolerance.getStimulationStatus(30);
        expect(status1.isStimulated).toBe(false);
        expect(status1.deficitMg).toBe(15);

        const status2 = tolerance.getStimulationStatus(50);
        expect(status2.isStimulated).toBe(true);
        expect(status2.deficitMg).toBe(0);
    });

    it('should calculate health risk level and protect against invalid negative weight', () => {
        expect(tolerance.getHealthStatus(100, 70, 100).level).toBe('SAFE');
        expect(tolerance.getHealthStatus(450, 70, 200).level).toBe('WARNING');
        expect(tolerance.getHealthStatus(650, 70, 300).level).toBe('HIGH_RISK');
        expect(tolerance.getHealthStatus(1200, 70, 300).level).toBe('CRITICAL');

        // Günlük 400mg kümülatif alım uyarısı testi
        expect(tolerance.getHealthStatus(150, 70, 450).level).toBe('WARNING');

        // Negatif kilo koruması testi (asgari 30kg'a sabitlenmeli)
        const safeCheck = tolerance.getHealthStatus(1200, -10, 200);
        expect(safeCheck.level).toBe('CRITICAL');
    });

    it('should evaluate withdrawal and adenosine rebound risks accurately', () => {
        // Kayıt yokken
        expect(tolerance.checkWithdrawalRisk(0, null).risk).toBe('NONE');

        // Yüksek tolerans + uzun süre geçiş + düşük kafein
        tolerance.setTolerance('HIGH');
        const fourteenHoursAgo = Date.now() - (15 * 60 * 60 * 1000);
        const rebound = tolerance.checkWithdrawalRisk(5, fourteenHoursAgo);
        expect(rebound.risk).toBe('HIGH');
        expect(rebound.message).toContain('Adenozin Rebound');

        // Güvenli uyku eşiği altında dinlenme durumu
        tolerance.setTolerance('LOW'); // sleepThreshold: 15mg
        const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
        const resting = tolerance.checkWithdrawalRisk(10, twoHoursAgo);
        expect(resting.risk).toBe('LOW');
        expect(resting.message).toContain('güvenli uyku eşiğinin altında');
    });
});
