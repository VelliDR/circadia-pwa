import { describe, it, expect, beforeEach } from 'vitest';
import { ToleranceEngine, ToleranceKey } from '../src/engine/ToleranceEngine';

describe('Tolerance Engine', () => {
    let tolerance: ToleranceEngine;

    beforeEach(() => {
        tolerance = new ToleranceEngine('MEDIUM');
    });

    it('should initialize with MEDIUM tolerance by default', () => {
        const t = new ToleranceEngine();
        expect(t.currentTolerance.id).toBe('MEDIUM');
    });

    it('should update tolerance level', () => {
        tolerance.setTolerance('HIGH');
        expect(tolerance.currentTolerance.id).toBe('HIGH');
        expect(tolerance.currentTolerance.thresholdMg).toBe(85);
    });

    it('should determine stimulation status', () => {
        const status1 = tolerance.getStimulationStatus(30);
        expect(status1.isStimulated).toBe(false);
        expect(status1.deficitMg).toBe(15);

        const status2 = tolerance.getStimulationStatus(50);
        expect(status2.isStimulated).toBe(true);
        expect(status2.deficitMg).toBe(0);
    });

    it('should calculate health risk level', () => {
        expect(tolerance.getHealthStatus(100).level).toBe('SAFE');
        expect(tolerance.getHealthStatus(450).level).toBe('WARNING');
        expect(tolerance.getHealthStatus(650).level).toBe('HIGH_RISK');
        expect(tolerance.getHealthStatus(1200).level).toBe('CRITICAL');
    });
});
