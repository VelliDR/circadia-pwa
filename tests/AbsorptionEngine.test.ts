import { describe, it, expect, beforeEach } from 'vitest';
import { AbsorptionEngine } from '../src/engine/AbsorptionEngine';
import { DRINK_DATABASE, getServing } from '../src/db/drinkDatabase';
import { DEFAULT_NUTRITION_PROFILE, MealRecord, SupplementRecord, DrinkRecord } from '../src/store/db';

describe('Absorption & Chronobiological Timing Engine', () => {
    let engine: AbsorptionEngine;

    const getDrink = (id: string) => DRINK_DATABASE.find(d => d.id === id)!;

    beforeEach(() => {
        engine = new AbsorptionEngine();
    });

    it('should guarantee zero drift and no artificial wait when optional meals and supplements are omitted', () => {
        const coffee = getDrink('filter_coffee');
        const serving = getServing(coffee, 'medium');
        const now = new Date('2026-10-25T10:00:00').getTime();

        const evalEmpty = engine.evaluateDrinkCandidate(coffee, serving, now, false, [], []);
        expect(evalEmpty.hasMealOrSupplementData).toBe(false);
        expect(evalEmpty.overallSeverity).toBe('NONE');
        expect(evalEmpty.collisions).toHaveLength(0);

        const windowEmpty = engine.getNextOptimalDrinkWindow(now, coffee, serving, false, [], []);
        expect(windowEmpty.isImmediateSafeForMeals).toBe(true);
        expect(windowEmpty.waitMinutesForMeals).toBe(0);
        expect(windowEmpty.mealSafeTimestamp).toBe(now);
    });

    it('should enforce -60 min safe pre-meal, 0..+60 min full collision, +90 min recovery, and +120 min clearance', () => {
        const blackTea = getDrink('black_tea_turkish');
        const serving = getServing(blackTea, 'mug'); // 200 ml
        const mealTime = new Date('2026-10-25T09:00:00').getTime();
        const plantMeal: MealRecord = {
            id: 1,
            label: 'Yulaf & Yumurta Kahvaltısı',
            matrixType: 'plant',
            hasVitaminC: false,
            timestamp: mealTime
        };

        // 1) Öğünden 60 dk önce (-60 dk): Morck et al. (1983) -> Güvenli (NONE)
        const pre60 = engine.evaluateDrinkCandidate(blackTea, serving, mealTime - 60 * 60000, false, [plantMeal], []);
        expect(pre60.overallSeverity).toBe('NONE');

        // 2) Öğünle birlikte / +15 dk sonra: Tam blokaj (HIGH)
        const post15 = engine.evaluateDrinkCandidate(blackTea, serving, mealTime + 15 * 60000, false, [plantMeal], []);
        expect(post15.overallSeverity).toBe('HIGH');
        expect(post15.collisions[0].isMorningHepcidinWindow).toBe(true);
        expect(post15.collisions[0].estimatedIronLossRangePct![1]).toBeGreaterThanOrEqual(75);

        // 3) Öğünden +90 dk sonra: Ahmad Fuzi et al. (2017) -> İnhibisyon belirgin azalmış olmalı
        const post90 = engine.evaluateDrinkCandidate(blackTea, serving, mealTime + 90 * 60000, false, [plantMeal], []);
        expect(post90.collisions[0].estimatedIronLossRangePct![1]).toBeLessThan(
            post15.collisions[0].estimatedIronLossRangePct![1]
        );

        // 4) Öğünden +120 dk sonra: Tam güvenli pencere (NONE)
        const post120 = engine.evaluateDrinkCandidate(blackTea, serving, mealTime + 120 * 60000, false, [plantMeal], []);
        expect(post120.overallSeverity).toBe('NONE');
    });

    it('should distinguish animal heme iron (porphyrin shield) from plant non-heme iron', () => {
        const peppermint = getDrink('peppermint_tea');
        const serving = getServing(peppermint);
        const mealTime = new Date('2026-10-25T19:00:00').getTime();

        const animalMeal: MealRecord = {
            id: 1,
            label: 'Izgara Kırmızı Et',
            matrixType: 'animal',
            hasVitaminC: false,
            timestamp: mealTime
        };
        const plantMeal: MealRecord = {
            id: 2,
            label: 'Mercimek Yemeği',
            matrixType: 'plant',
            hasVitaminC: false,
            timestamp: mealTime
        };

        const evalAnimal = engine.evaluateDrinkCandidate(peppermint, serving, mealTime + 10 * 60000, false, [animalMeal], []);
        expect(evalAnimal.overallSeverity).toBe('LOW');
        expect(evalAnimal.collisions[0].waitMoreMinutes).toBe(0);
        expect(evalAnimal.collisions[0].isMorningHepcidinWindow).toBe(false);

        const evalPlant = engine.evaluateDrinkCandidate(peppermint, serving, mealTime + 10 * 60000, false, [plantMeal], []);
        expect(evalPlant.overallSeverity).toBe('HIGH');
        expect(evalPlant.collisions[0].waitMoreMinutes).toBeGreaterThan(0);
    });

    it('should model milk Ca2+ DMT1 amplification, Vitamin C partial rescue, and Rooibos safe swap', () => {
        const coffee = getDrink('filter_coffee');
        const serving = getServing(coffee, 'medium');
        const mealTime = new Date('2026-10-25T13:00:00').getTime();

        const basePlantMeal: MealRecord = {
            id: 1,
            label: 'Nohut Salatası',
            matrixType: 'plant',
            hasVitaminC: false,
            timestamp: mealTime
        };
        const vitCPlantMeal: MealRecord = { ...basePlantMeal, id: 2, hasVitaminC: true };

        const plainEval = engine.evaluateDrinkCandidate(coffee, serving, mealTime + 10 * 60000, false, [basePlantMeal], []);
        const milkEval = engine.evaluateDrinkCandidate(coffee, serving, mealTime + 10 * 60000, true, [basePlantMeal], []);
        const vitCEval = engine.evaluateDrinkCandidate(coffee, serving, mealTime + 10 * 60000, false, [vitCPlantMeal], []);

        // Süt eklenmesi taneni nötrlemez, Ca2+ rekabetiyle kaybı artırır
        expect(milkEval.collisions[0].estimatedIronLossRangePct![1]).toBeGreaterThan(
            plainEval.collisions[0].estimatedIronLossRangePct![1]
        );
        // C vitamini inhibisyonu kısmen kırar
        expect(vitCEval.collisions[0].estimatedIronLossRangePct![1]).toBeLessThan(
            plainEval.collisions[0].estimatedIronLossRangePct![1]
        );

        // Rooibos çayı tanensiz güvenli alternatiftir
        const rooibos = getDrink('rooibos_tea');
        const rooibosEval = engine.evaluateDrinkCandidate(rooibos, getServing(rooibos), mealTime + 10 * 60000, false, [basePlantMeal], []);
        expect(rooibosEval.overallSeverity).toBe('NONE');
    });

    it('should detect folate (DHFR/PCFT), iron, and thiamine supplement collisions and support therapeutic iron_overload mode', () => {
        const greenTea = getDrink('green_tea');
        const coffee = getDrink('filter_coffee');
        const t = new Date('2026-10-25T08:30:00').getTime();

        const supplements: SupplementRecord[] = [
            { id: 1, label: 'Folik Asit 400 mcg', supplementType: 'folate', timestamp: t },
            { id: 2, label: 'B1 Tiamin', supplementType: 'thiamine', timestamp: t }
        ];

        const folateEval = engine.evaluateDrinkCandidate(
            greenTea,
            getServing(greenTea),
            t + 20 * 60000,
            false,
            [],
            [supplements[0]],
            { ...DEFAULT_NUTRITION_PROFILE, specialCondition: 'pregnant' }
        );
        expect(folateEval.overallSeverity).toBe('HIGH');
        expect(folateEval.collisions[0].affectedNutrients[0]).toContain('Folik Asit');

        const thiamineEval = engine.evaluateDrinkCandidate(coffee, getServing(coffee), t + 15 * 60000, false, [], [supplements[1]]);
        expect(thiamineEval.overallSeverity).toBe('MODERATE');

        // Hemokromatozis / talasemi ters (terapötik) mod testi
        const plantMeal: MealRecord = { id: 10, label: 'Baklagil Öğünü', matrixType: 'plant', hasVitaminC: false, timestamp: t };
        const overloadEval = engine.evaluateDrinkCandidate(
            getDrink('black_tea_turkish'),
            getServing(getDrink('black_tea_turkish'), 'mug'),
            t + 5 * 60000,
            false,
            [plantMeal],
            [],
            { ...DEFAULT_NUTRITION_PROFILE, specialCondition: 'iron_overload' }
        );
        expect(overloadEval.overallSeverity).toBe('THERAPEUTIC');
        expect(overloadEval.collisions[0].waitMoreMinutes).toBe(0);
    });

    it('should evaluate daily urinary calcium loss and VDR suppression risk without requiring meal logs', () => {
        const now = Date.now();
        const drinks: DrinkRecord[] = [
            { id: 1, drinkId: 'filter_coffee', name: 'Filtre Kahve', caffeineMg: 180, timestamp: now - 3600000, hasMilk: false },
            { id: 2, drinkId: 'filter_coffee', name: 'Filtre Kahve', caffeineMg: 180, timestamp: now - 7200000, hasMilk: false }
        ];

        const highRiskCa = engine.evaluateDailyCalciumBalance(drinks, now, {
            ...DEFAULT_NUTRITION_PROFILE,
            calciumIntakeLevel: 'low',
            specialCondition: 'postmenopausal'
        });
        expect(highRiskCa.dailyCaffeineMg).toBe(360);
        expect(highRiskCa.estimatedUrinaryCaLossMg).toBeGreaterThan(10);
        expect(highRiskCa.vdrSuppressionRisk).toBe('HIGH');

        const milkDrinks: DrinkRecord[] = drinks.map(d => ({ ...d, hasMilk: true }));
        const compensatedCa = engine.evaluateDailyCalciumBalance(milkDrinks, now, {
            ...DEFAULT_NUTRITION_PROFILE,
            calciumIntakeLevel: 'adequate'
        });
        expect(compensatedCa.netCalciumDeltaMg).toBeGreaterThan(0);
        expect(compensatedCa.vdrSuppressionRisk).toBe('NONE');
    });
});
