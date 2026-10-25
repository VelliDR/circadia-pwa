import { describe, it, expect } from 'vitest';
import {
    DRINK_DATABASE,
    calculateCaffeineMg,
    calculatePolyphenolMg,
    getServing,
    formatSourceComparison
} from '../src/db/drinkDatabase';

describe('Drink Database & Comparative (USDA | TÜRKOMP) Dosing Model', () => {
    it('should have valid servings, non-negative coefficients, and parenthetical (USDA | TÜRKOMP) strings for every drink', () => {
        expect(DRINK_DATABASE.length).toBeGreaterThanOrEqual(25);

        for (const drink of DRINK_DATABASE) {
            expect(drink.servings.length).toBeGreaterThan(0);
            const defaultServing = getServing(drink);
            expect(defaultServing).toBeDefined();
            expect(drink.caffeineMgPerUnit).toBeGreaterThanOrEqual(0);
            expect(drink.polyphenols.polyphenolMgPerUnit).toBeGreaterThanOrEqual(0);

            const comp = formatSourceComparison(drink);
            expect(comp.startsWith('(')).toBe(true);
            expect(comp.endsWith(')')).toBe(true);
            expect(comp).toContain('USDA:');
            expect(comp).toContain('| TÜRKOMP:');
        }
    });

    it('should scale volume-based drinks linearly with ml according to USDA FDC values', () => {
        const filter = DRINK_DATABASE.find(d => d.id === 'filter_coffee')!;
        expect(filter.mode).toBe('volume');
        // USDA FDC 171890: 40 mg / 100 g -> 250 ml orta kupa = 100 mg (eski hatalı ~194 mg yerine)
        expect(calculateCaffeineMg(filter, getServing(filter, 'medium'))).toBe(100);
        expect(calculateCaffeineMg(filter, getServing(filter, 'large'))).toBe(140);

        const teaBag = DRINK_DATABASE.find(d => d.id === 'black_tea_bag')!;
        // USDA FDC 173227: 20 mg / 100 g -> 180 ml fincan = 36 mg, 250 ml kupa = 50 mg
        expect(calculateCaffeineMg(teaBag, getServing(teaBag, 'cup'))).toBe(36);
        expect(calculateCaffeineMg(teaBag, getServing(teaBag, 'mug'))).toBe(50);
    });

    it('should scale espresso-based drinks strictly by shot count rather than water/milk cup volume', () => {
        const americano = DRINK_DATABASE.find(d => d.id === 'americano')!;
        const latte = DRINK_DATABASE.find(d => d.id === 'latte')!;
        expect(americano.mode).toBe('count');
        expect(latte.mode).toBe('count');

        // Tek shot (30 ml * 212 mg/100g = 63.6 mg -> 64 mg); Double shot (60 ml * 2.12 = 127.2 mg -> 127 mg)
        expect(calculateCaffeineMg(americano, getServing(americano, 'x1'))).toBe(64);
        expect(calculateCaffeineMg(americano, getServing(americano, 'x2'))).toBe(127);
        expect(calculateCaffeineMg(latte, getServing(latte, 'x1'))).toBe(64);
        expect(calculateCaffeineMg(latte, getServing(latte, 'x2'))).toBe(127);
    });

    it('should distinguish pure instant coffee powder from 3-in-1 sachets', () => {
        const instant = DRINK_DATABASE.find(d => d.id === 'granule_classic')!;
        const mix3in1 = DRINK_DATABASE.find(d => d.id === 'granule_3in1')!;

        // 1 tepeleme çay kaşığı (~2 g, USDA 3142 mg/100g = 62.84 mg -> 63 mg)
        expect(calculateCaffeineMg(instant, getServing(instant, 'x1'))).toBe(63);
        // 1 paket 3'ü 1 arada (~17.5 g, USDA 404 mg/100g = 70.7 mg -> 71 mg)
        expect(calculateCaffeineMg(mix3in1, getServing(mix3in1, 'x1'))).toBe(71);
    });

    it('should model decaf herbal teas with 0 mg caffeine while preserving polyphenol/tannin inhibition profiles', () => {
        const peppermint = DRINK_DATABASE.find(d => d.id === 'peppermint_tea')!;
        const rooibos = DRINK_DATABASE.find(d => d.id === 'rooibos_tea')!;

        expect(calculateCaffeineMg(peppermint, getServing(peppermint))).toBe(0);
        expect(calculatePolyphenolMg(peppermint, getServing(peppermint))).toBeGreaterThan(150);
        expect(peppermint.polyphenols.ironInhibitionClass).toBe('VERY_HIGH');

        expect(calculateCaffeineMg(rooibos, getServing(rooibos))).toBe(0);
        expect(rooibos.polyphenols.ironInhibitionClass).toBe('NONE');
    });
});
