import { describe, it, expect, beforeEach } from 'vitest';
import { ToleranceEngine } from '../src/engine/ToleranceEngine';
import { DrinkRecord } from '../src/store/db';

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

    it('should distinguish systemic body load warnings, daily intake limits, and pregnancy limits', () => {
        expect(tolerance.getHealthStatus(100, 70, 100).level).toBe('SAFE');

        // Yüksek anlık sistemik yük (~9.9 mg/L plazma) vs günlük 400 mg kümülatif alım
        const bodyLoadWarn = tolerance.getHealthStatus(450, 70, 200);
        expect(bodyLoadWarn.level).toBe('WARNING');
        expect(bodyLoadWarn.title).toContain('Plazma');

        const dailyWarn = tolerance.getHealthStatus(150, 70, 450);
        expect(dailyWarn.level).toBe('WARNING');
        expect(dailyWarn.title).toContain('400 mg');

        // Gebelik günlük 200 mg sınırı
        const pregWarn = tolerance.getHealthStatus(80, 65, 210, true);
        expect(pregWarn.level).toBe('WARNING');
        expect(pregWarn.title).toContain('200 mg');

        // Yüksek toksisite ve kritik akut toksisite
        expect(tolerance.getHealthStatus(650, 70, 300).level).toBe('HIGH_RISK');
        expect(tolerance.getHealthStatus(1200, 70, 300).level).toBe('CRITICAL');

        // Negatif kilo koruması testi (asgari 30kg'a sabitlenmeli)
        const safeCheck = tolerance.getHealthStatus(1200, -10, 200);
        expect(safeCheck.level).toBe('CRITICAL');
    });

    it('should check EFSA single-dose limits (200 mg or 3 mg/kg, 150 mg in pregnancy)', () => {
        expect(tolerance.checkSingleDose(180, 70, false).exceedsLimit).toBe(false);
        expect(tolerance.checkSingleDose(220, 70, false).exceedsLimit).toBe(true);
        // 50 kg bireyde 3 mg/kg = 150 mg sınırı
        expect(tolerance.checkSingleDose(165, 50, false).exceedsLimit).toBe(true);
        // Gebelikte 150 mg tek doz sınırı
        expect(tolerance.checkSingleDose(160, 70, true).exceedsLimit).toBe(true);
    });

    it('should calculate cumulative intake for both midnight and rolling 24h shift windows', () => {
        const fakeNow = new Date('2026-10-25T02:00:00').getTime();
        const beforeMidnight = new Date('2026-10-24T22:30:00').getTime(); // 3.5 hours ago (yesterday)
        const afterMidnight = new Date('2026-10-25T01:00:00').getTime();  // 1 hour ago (today)

        const history: DrinkRecord[] = [
            { id: 1, name: 'Filtre Kahve', caffeineMg: 100, timestamp: beforeMidnight },
            { id: 2, name: 'Espresso', caffeineMg: 64, timestamp: afterMidnight }
        ];

        const midnightCalc = tolerance.calculateCumulativeIntake(history, fakeNow, 'midnight');
        expect(midnightCalc.midnightMg).toBe(64);
        expect(midnightCalc.rolling24hMg).toBe(164);
        expect(midnightCalc.activeWindowMg).toBe(64);

        const shiftCalc = tolerance.calculateCumulativeIntake(history, fakeNow, 'rolling24h');
        expect(shiftCalc.activeWindowMg).toBe(164);
    });

    it('should evaluate withdrawal and adenosine rebound risks accurately', () => {
        expect(tolerance.checkWithdrawalRisk(0, null).risk).toBe('NONE');

        tolerance.setTolerance('HIGH');
        const fifteenHoursAgo = Date.now() - (15 * 60 * 60 * 1000);
        const rebound = tolerance.checkWithdrawalRisk(5, fifteenHoursAgo);
        expect(rebound.risk).toBe('HIGH');
        expect(rebound.message).toContain('Adenozin Rebound');

        tolerance.setTolerance('LOW'); // sleepThreshold: 15mg
        const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
        const resting = tolerance.checkWithdrawalRisk(10, twoHoursAgo);
        expect(resting.risk).toBe('LOW');
        expect(resting.message).toContain('güvenli uyku eşiğinin altında');
    });
});
