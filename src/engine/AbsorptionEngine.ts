/**
 * @file AbsorptionEngine.ts
 * @description Çay, kahve, bitki çayları ve kakaodaki polifenol/tanen/kafein matrisinin
 * demir (hem vs. non-hem), folat (B9), tiamin (B1), kalsiyum/VDR, çinko ve bitkisel protein
 * emilimi üzerindeki kronobiyolojik etkilerini hesaplayan saf (DOM-bağımsız) motor.
 *
 * Temel İlke: Öğün ve takviye kaydı %100 isteğe bağlıdır. Kayıt girilmediğinde motor hiçbir
 * yapay çakışma üretmez ve kafein/uyku hesaplamalarını kesinlikle değiştirmez.
 */

import { Drink, ServingOption, calculatePolyphenolMg, calculateCaffeineMg, isIntrinsicMilkDrink } from '../db/drinkDatabase';
import {
    DrinkRecord,
    MealRecord,
    SupplementRecord,
    NutritionProfile,
    DEFAULT_NUTRITION_PROFILE
} from '../store/db';

export type CollisionSeverity = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'THERAPEUTIC';

export interface NutrientCollision {
    targetType: 'meal' | 'supplement';
    targetId: number;
    targetLabel: string;
    deltaMinutes: number;
    severity: CollisionSeverity;
    /** Tahmini tek-öğün non-hem demir inhibisyon aralığı (%) */
    estimatedIronLossRangePct: [number, number] | null;
    isMorningHepcidinWindow: boolean;
    affectedNutrients: string[];
    headline: string;
    mechanismNote: string;
    waitMoreMinutes: number;
    evidenceRef: string;
}

export interface DrinkAbsorptionEvaluation {
    hasMealOrSupplementData: boolean;
    overallSeverity: CollisionSeverity;
    polyphenolMg: number;
    caffeineMg: number;
    effectiveMilk: boolean;
    collisions: NutrientCollision[];
    summaryMessage: string;
    mitigationTips: string[];
}

export interface CalciumBalanceEvaluation {
    dailyCaffeineMg: number;
    estimatedUrinaryCaLossMg: number;
    milkServingsCount: number;
    estimatedMilkCaOffsetMg: number;
    netCalciumDeltaMg: number;
    vdrSuppressionRisk: 'NONE' | 'MODERATE' | 'HIGH';
    headline: string;
    detail: string;
}

export interface OptimalWindowSuggestion {
    isImmediateSafeForMeals: boolean;
    mealSafeTimestamp: number;
    waitMinutesForMeals: number;
    blockingTargetLabel: string | null;
    exceedsSleepCutoffIfDrunkAtSafeTime: boolean;
    recommendationText: string;
}

export class AbsorptionEngine {
    /**
     * İçecek tüketim zamanı ile öğün/takviye zamanı arasındaki farka göre (Δt = t_içecek - t_öğün, dk)
     * intralüminal karşılaşma katsayısını [0..1] döndürür.
     * - Δt <= -60 dk : 0 (Morck et al., 1983 — sıvı mideyi öğünden önce terk eder)
     * - -60 < Δt < 0 : 0..0.55 (kısmi karşılaşma)
     * - 0 <= Δt <= +60: 1.0 (tam karşılaşma — katı öğün mide boşalması 1–2 sa)
     * - +60 < Δt < +120: 0.36..0 (Ahmad Fuzi et al., 2017 — 1 sa ara emilimi 2.5–3x kurtarır)
     * - Δt >= +120 dk: 0 (güvenli öğün arası pencere)
     */
    getTimingOverlapFactor(deltaMinutes: number): number {
        if (deltaMinutes <= -60 || deltaMinutes >= 120) {
            return 0;
        }
        if (deltaMinutes < 0) {
            return 0.55 * (1 - Math.abs(deltaMinutes) / 60);
        }
        if (deltaMinutes <= 60) {
            return 1.0;
        }
        // +60 ile +120 dk arası sönümlenen kuyruk
        return 0.36 * (1 - (deltaMinutes - 60) / 60);
    }

    /**
     * Öğün veya takviyeden sonra güvenli pencereye ulaşmak için gereken kalan dakikayı hesaplar.
     * - Öğünden önce (-60..0 dk): Öğünden en az 60 dk önce içilmeliydi; öğün sonrası +60/+120 dk beklenmeli.
     * - Öğünden sonra (0..120 dk): Tam güvenlik için +120 dk (pratik kırılma noktası +60 dk).
     */
    getRemainingWaitMinutes(deltaMinutes: number, strictTwoHours: boolean = false): number {
        const targetPostMealMin = strictTwoHours ? 120 : 60;
        if (deltaMinutes <= -60 || deltaMinutes >= targetPostMealMin) {
            return 0;
        }
        return Math.max(0, Math.ceil(targetPostMealMin - deltaMinutes));
    }

    /**
     * Sabah 05:30 - 11:30 arası hepsidin hormonu sirkadiyen dip noktasında olduğu için
     * non-hem demir emiliminin akşam saatlerine göre ~%70 daha yüksek olduğu penceredir.
     */
    isMorningHepcidinPeak(timestampMs: number): boolean {
        const d = new Date(timestampMs);
        const totalMin = d.getHours() * 60 + d.getMinutes();
        return totalMin >= (5 * 60 + 30) && totalMin <= (11 * 60 + 30);
    }

    /**
     * Polifenol miktarına göre doz ölçekleme çarpanı (Hurrell et al., 1999).
     * Standart porsiyon (~150-220 mg polifenol) = 1.0 referans alınır.
     */
    private getPolyphenolDoseFactor(polyphenolMg: number): number {
        if (polyphenolMg <= 10) return 0;
        if (polyphenolMg <= 50) return 0.78;  // 20-50 mg polifenol: %50-70 bandı
        if (polyphenolMg <= 180) return 1.0;  // Standart porsiyon
        return Math.min(1.22, 1.0 + ((polyphenolMg - 180) / 600)); // Yoğun/duble demleme
    }

    /**
     * Seçilen veya kaydedilecek bir içeceğin opsiyonel öğün/takviye geçmişiyle etkileşimini değerlendirir.
     */
    evaluateDrinkCandidate(
        drink: Drink,
        serving: ServingOption,
        drinkTimestamp: number,
        hasAddedMilk: boolean = false,
        meals: MealRecord[] = [],
        supplements: SupplementRecord[] = [],
        profile: NutritionProfile = DEFAULT_NUTRITION_PROFILE
    ): DrinkAbsorptionEvaluation {
        const polyphenolMg = calculatePolyphenolMg(drink, serving);
        const caffeineMg = calculateCaffeineMg(drink, serving);
        const effectiveMilk = hasAddedMilk || isIntrinsicMilkDrink(drink);

        // KURAL 1: Öğün ve takviye kaydı yoksa hesaplama şaşmaz, boş/temiz sonuç döner.
        if ((!meals || meals.length === 0) && (!supplements || supplements.length === 0)) {
            return {
                hasMealOrSupplementData: false,
                overallSeverity: 'NONE',
                polyphenolMg,
                caffeineMg,
                effectiveMilk,
                collisions: [],
                summaryMessage: 'Kayıtlı öğün/takviye yok — yalnızca kafein ve biyoritim simülasyonu aktif.',
                mitigationTips: []
            };
        }

        const collisions: NutrientCollision[] = [];
        const mitigationTipsSet = new Set<string>();
        const isStrictGroup = profile.specialCondition === 'ida_risk'
            || profile.specialCondition === 'pregnant'
            || profile.dietType === 'vegan'
            || profile.dietType === 'vegetarian';

        // 1. ÖĞÜN ÇAKIŞMALARI
        for (const meal of meals) {
            const deltaMin = Math.round((drinkTimestamp - meal.timestamp) / 60000);
            if (deltaMin <= -60 || deltaMin >= 120) continue;

            const timingFactor = this.getTimingOverlapFactor(deltaMin);
            if (timingFactor <= 0.05) continue;

            const affected: string[] = [];
            let estIronRange: [number, number] | null = null;
            let severity: CollisionSeverity = 'NONE';
            const morningPeak = this.isMorningHepcidinPeak(meal.timestamp);

            // A) Demir (Hem vs Non-Hem Dikotomisi)
            const [refMin, refMax] = drink.polyphenols.referenceInhibitionPct;
            const doseFactor = this.getPolyphenolDoseFactor(polyphenolMg);
            const hasTanninBlock = drink.polyphenols.ironInhibitionClass !== 'NONE' && refMax > 0 && doseFactor > 0;

            if (hasTanninBlock || effectiveMilk) {
                // Hayvansal hem demir porfirin halkasıyla korunur; Et Faktörü non-hem demiri de destekler
                const matrixFactor = meal.matrixType === 'animal'
                    ? 0.15
                    : meal.matrixType === 'mixed'
                        ? 0.55
                        : 1.0;

                let lowPct = 0;
                let highPct = 0;

                if (hasTanninBlock) {
                    // Süt eklenmesi tanenleri nötrlemez; Ca2+ DMT1 rekabetiyle inhibisyonu artırır (Morck 1983)
                    const milkMultiplier = effectiveMilk ? 1.25 : 1.0;
                    // C vitamini Fe3+ -> Fe2+ indirgeyerek inhibisyonu kısmen kırar (~%20 kalıntı kayıp kalır)
                    const vitCMultiplier = meal.hasVitaminC ? 0.45 : 1.0;

                    lowPct = Math.min(95, Math.round(refMin * doseFactor * timingFactor * matrixFactor * milkMultiplier * vitCMultiplier));
                    highPct = Math.min(95, Math.round(refMax * doseFactor * timingFactor * matrixFactor * milkMultiplier * vitCMultiplier));
                } else if (effectiveMilk) {
                    // Tanensiz içeceğe (örn. Rooibos) süt eklendiğinde yalnızca süt kalsiyumu DMT1 rekabeti oluşur
                    lowPct = Math.round(15 * timingFactor * matrixFactor);
                    highPct = Math.round(28 * timingFactor * matrixFactor);
                }

                if (meal.matrixType === 'animal') {
                    severity = 'LOW';
                    estIronRange = [lowPct, highPct];
                    affected.push('Minör Non-Hem Demir (Hem demir korunur)');
                } else if (highPct >= 10) {
                    estIronRange = [lowPct, highPct];
                    affected.push('Bitkisel Non-Hem Demir (Fe³⁺)');
                    if (highPct >= 50) {
                        severity = 'HIGH';
                    } else if (highPct >= 25) {
                        severity = 'MODERATE';
                    } else {
                        severity = 'LOW';
                    }
                }

                if (!meal.hasVitaminC && meal.matrixType !== 'animal' && hasTanninBlock && severity !== 'LOW' && severity !== 'NONE') {
                    mitigationTipsSet.add('Öğüne ~200 mg C vitamini (taze biber, narenciye, kivi) eklemek Fe³⁺ iyonlarını Fe²⁺ formuna indirgeyerek tanen blokajını kısmen azaltır.');
                }
                if (effectiveMilk && meal.matrixType !== 'animal' && severity !== 'NONE') {
                    mitigationTipsSet.add('Süt eklemek tanenleri etkisizleştirmez; sütteki kalsiyum DMT1 taşıyıcısında demirle rekabet ederek blokajı artırabilir (Morck et al., 1983).');
                }
            }

            // B) Folat (B9) — EGCG/ECG DHFR & PCFT inhibisyonu
            if (drink.polyphenols.folateInteraction === 'HIGH' && meal.matrixType !== 'animal' && deltaMin >= -45 && deltaMin <= 90) {
                affected.push('Doğal Folat (B9 / 5-MTHF)');
                if (profile.specialCondition === 'pregnant') {
                    severity = 'HIGH';
                    mitigationTipsSet.add('Gebelikte çay kateşinleri (EGCG/ECG) PCFT ve DHFR üzerinden folat emilimini azaltır; yeşillik/baklagil öğünlerinden 1–2 saat ayırınız.');
                } else if (severity === 'NONE' || severity === 'LOW') {
                    severity = 'MODERATE';
                }
            }

            // C) Tiamin (B1) — Termostabil antitiamin faktörler (kafeik asit / tannik asit)
            if (drink.polyphenols.thiamineInteraction === 'HIGH' && meal.matrixType === 'plant' && !meal.hasVitaminC && deltaMin >= -30 && deltaMin <= 90) {
                affected.push('Serbest Tiamin (B1)');
                if (severity === 'NONE') severity = 'LOW';
            }

            // D) Bitkisel Protein (PDCAAS/DIAAS) & Fitatlı Çinko
            if ((drink.polyphenols.ironInhibitionClass === 'VERY_HIGH' || drink.polyphenols.ironInhibitionClass === 'HIGH')
                && meal.matrixType === 'plant'
                && (profile.dietType === 'vegan' || profile.dietType === 'vegetarian')
                && deltaMin >= -15 && deltaMin <= 60) {
                affected.push('Bitkisel Protein & Fitat Bağlı Çinko');
            }

            if (severity === 'NONE') continue;

            // E) Ters Mod: Aşırı Demir Yüklenmesi (Hemokromatozis / TDT)
            if (profile.specialCondition === 'iron_overload' && meal.matrixType !== 'animal' && (severity === 'HIGH' || severity === 'MODERATE')) {
                severity = 'THERAPEUTIC';
            }

            const waitMore = this.getRemainingWaitMinutes(deltaMin, isStrictGroup);
            const headline = severity === 'THERAPEUTIC'
                ? `🩺 Terapötik Demir Blokajı (${meal.label})`
                : meal.matrixType === 'animal'
                    ? `🛡️ Porfirin Kalkanı Aktif (${meal.label})`
                    : severity === 'HIGH'
                        ? `⚠️ Yüksek Emilim Blokajı (${meal.label}${morningPeak ? ' · Sabah Hepsidin Zirvesi' : ''})`
                        : `⚡ Orta Düzey Emilim Etkileşimi (${meal.label})`;

            const mechanismNote = severity === 'THERAPEUTIC'
                ? `${drink.name} polifenolleri (${polyphenolMg} mg) öğündeki non-hem demiri bağlayarak emilimi azaltır (~%${estIronRange?.[0]}–${estIronRange?.[1]}). Hemokromatozis/talasemi profilinde bu etki hedeflenen yöndedir (hekim takibi esastır).`
                : meal.matrixType === 'animal'
                    ? `Hayvansal dokudaki hem demir (Fe²⁺) protoporfirin halkasıyla korunduğu için tanen şelasyonundan anlamlı etkilenmez; "Et Faktörü" peptitleri de emilimi destekler.`
                    : `${drink.polyphenols.dominantCompounds} bağırsak lümeninde çözünmez kompleks oluşturur (Tahmini tek-öğün non-hem demir kaybı: ~%${estIronRange?.[0] ?? 20}–${estIronRange?.[1] ?? 50}).${morningPeak ? ' Sabah saatlerinde hepsidin düşük olduğundan günün en yüksek (%70+) demir emilim potansiyeli kaybedilebilir.' : ''}`;

            collisions.push({
                targetType: 'meal',
                targetId: meal.id,
                targetLabel: meal.label,
                deltaMinutes: deltaMin,
                severity,
                estimatedIronLossRangePct: estIronRange,
                isMorningHepcidinWindow: morningPeak,
                affectedNutrients: affected,
                headline,
                mechanismNote,
                waitMoreMinutes: severity === 'THERAPEUTIC' || meal.matrixType === 'animal' ? 0 : waitMore,
                evidenceRef: 'Hurrell et al., 1999; Morck et al., 1983; Ahmad Fuzi et al., 2017'
            });
        }

        // 2. TAKVİYE (SUPPLEMENT) ÇAKIŞMALARI
        for (const supp of supplements) {
            const deltaMin = Math.round((drinkTimestamp - supp.timestamp) / 60000);
            if (deltaMin <= -60 || deltaMin >= 120) continue;

            const timingFactor = this.getTimingOverlapFactor(deltaMin);
            if (timingFactor <= 0.05) continue;

            const morningPeak = this.isMorningHepcidinPeak(supp.timestamp);
            const waitMore = this.getRemainingWaitMinutes(deltaMin, true); // Takviyelerde 2 saat ara önerilir

            if (supp.supplementType === 'iron') {
                const [refMin, refMax] = drink.polyphenols.referenceInhibitionPct;
                const hasPolyphenolBlock = refMax > 0 && polyphenolMg > 10;
                const hasCalciumBlock = effectiveMilk;

                if (!hasPolyphenolBlock && !hasCalciumBlock) continue;

                const lowPct = hasPolyphenolBlock ? Math.round(refMin * timingFactor) : 25;
                const highPct = hasPolyphenolBlock
                    ? Math.min(95, Math.round(refMax * timingFactor * (effectiveMilk ? 1.2 : 1.0)))
                    : 40;

                const severity: CollisionSeverity = profile.specialCondition === 'iron_overload'
                    ? 'THERAPEUTIC'
                    : highPct >= 45 ? 'HIGH' : 'MODERATE';

                collisions.push({
                    targetType: 'supplement',
                    targetId: supp.id,
                    targetLabel: supp.label,
                    deltaMinutes: deltaMin,
                    severity,
                    estimatedIronLossRangePct: [lowPct, highPct],
                    isMorningHepcidinWindow: morningPeak,
                    affectedNutrients: ['Demir Takviyesi (Non-Hem / NaFeEDTA / Fe²⁺)'],
                    headline: `💊 Demir Takviyesi Çakışması (${supp.label})`,
                    mechanismNote: `Çay/kahve polifenolleri ve süt kalsiyumu, inorganik demir tuzları ile şelatlı NaFeEDTA takviyelerinin biyoyararlanımını ~%${lowPct}–${highPct} oranında düşürür.${morningPeak ? ' Sabah hepsidin penceresini korumak için su veya C vitamini ile alınız.' : ''}`,
                    waitMoreMinutes: waitMore,
                    evidenceRef: 'Lazrak et al., 2021; Morck et al., 1983; Ahmad Fuzi et al., 2017'
                });
                mitigationTipsSet.add('Demir takviyesini çay/kahve/bitki çayından en az 1 saat sonra (veya içecekten ≥2 saat sonra) sade su ya da C vitaminiyle alınız.');
            } else if (supp.supplementType === 'folate') {
                if (drink.polyphenols.folateInteraction === 'NONE' && caffeineMg < 50) continue;
                const isHighCatechin = drink.polyphenols.folateInteraction === 'HIGH';
                const severity: CollisionSeverity = isHighCatechin || profile.specialCondition === 'pregnant' ? 'HIGH' : 'MODERATE';

                collisions.push({
                    targetType: 'supplement',
                    targetId: supp.id,
                    targetLabel: supp.label,
                    deltaMinutes: deltaMin,
                    severity,
                    estimatedIronLossRangePct: null,
                    isMorningHepcidinWindow: false,
                    affectedNutrients: ['Sentetik Folik Asit / 5-MTHF (B9)'],
                    headline: `💊 Folik Asit / B9 Emilim Blokajı (${supp.label})`,
                    mechanismNote: isHighCatechin
                        ? `Yeşil ve siyah çaydaki EGCG/ECG kateşinleri metotreksat benzeri yapılarıyla DHFR enzimini ve bağırsak PCFT taşıyıcısını yarışmalı inhibe ederek 0.4 mg ve 5 mg folik asit C_max düzeyini anlamlı düşürür.`
                        : `Yüksek polifenol/kafein alımı folat biyoyararlanımını olumsuz etkileyebilir; özellikle gebelikte takviyeyi su ile ayrı saatte alınız.`,
                    waitMoreMinutes: waitMore,
                    evidenceRef: 'Alemdaroglu et al., 2008'
                });
            } else if (supp.supplementType === 'thiamine' && drink.polyphenols.thiamineInteraction !== 'NONE') {
                collisions.push({
                    targetType: 'supplement',
                    targetId: supp.id,
                    targetLabel: supp.label,
                    deltaMinutes: deltaMin,
                    severity: 'MODERATE',
                    estimatedIronLossRangePct: null,
                    isMorningHepcidinWindow: false,
                    affectedNutrients: ['Tiamin (B1 Vitamini)'],
                    headline: `💊 Antitiamin Faktör Etkileşimi (${supp.label})`,
                    mechanismNote: `Kahvedeki kafeik/klorojenik asit ve çaydaki tannik asit, serbest tiaminin tiazol halkasını okside ederek emilemeyen tiamin disülfite dönüştürür.`,
                    waitMoreMinutes: waitMore,
                    evidenceRef: 'Somogyi et al., 1976'
                });
            }
        }

        if (drink.id !== 'rooibos_tea' && collisions.some(c => c.severity === 'HIGH')) {
            mitigationTipsSet.add('Öğünle sıcak bir içecek arıyorsanız tanen oranı çok düşük olan Rooibos çayı demir emilimini bozmayan güvenli bir alternatiftir.');
        }

        const overallSeverity = this.resolveOverallSeverity(collisions);
        const summaryMessage = this.buildSummaryMessage(overallSeverity, collisions, drink);

        return {
            hasMealOrSupplementData: true,
            overallSeverity,
            polyphenolMg,
            caffeineMg,
            effectiveMilk,
            collisions,
            summaryMessage,
            mitigationTips: Array.from(mitigationTipsSet)
        };
    }

    private resolveOverallSeverity(collisions: NutrientCollision[]): CollisionSeverity {
        if (collisions.length === 0) return 'NONE';
        if (collisions.some(c => c.severity === 'HIGH')) return 'HIGH';
        if (collisions.some(c => c.severity === 'MODERATE')) return 'MODERATE';
        if (collisions.some(c => c.severity === 'THERAPEUTIC')) return 'THERAPEUTIC';
        if (collisions.some(c => c.severity === 'LOW')) return 'LOW';
        return 'NONE';
    }

    private buildSummaryMessage(severity: CollisionSeverity, collisions: NutrientCollision[], drink: Drink): string {
        if (collisions.length === 0) {
            return `🟢 Güvenli Zamanlama: ${drink.name} kayıtlı öğün/takviye emilim pencereleriyle çakışmıyor.`;
        }
        const top = collisions[0];
        if (severity === 'THERAPEUTIC') {
            return `🩺 Terapötik Pencere: ${top.targetLabel} ile eş zamanlı tüketim demir emilimini baskılamak için uygundur.`;
        }
        if (severity === 'LOW') {
            return top.headline.includes('Porfirin')
                ? `🛡️ Düşük Etki: ${top.targetLabel} hayvansal hem demir içerdiği için tanen blokajına dirençlidir.`
                : `🟢 Düşük Etkileşim: ${top.targetLabel} için kalan emilim etkisi minimal düzeydedir.`;
        }
        const waitTxt = top.waitMoreMinutes > 0 ? ` İdeal emilim için ~${top.waitMoreMinutes} dk beklenmesi önerilir.` : '';
        return `${top.headline}:${waitTxt}`;
    }

    /**
     * Günlük kafein alımına bağlı böbrek kalsiyum atılımını (hiperkalsiüri) ve VDR baskılanma riskini hesaplar.
     * Öğün kaydı girilmese bile yalnızca içecek geçmişinden doğru biçimde çalışır.
     * Literatür: ~6 mg net Ca kaybı / 175 mg kafein (~5 mg Ca / fincan kahve); Rapuri et al., 2007/2019.
     */
    evaluateDailyCalciumBalance(
        drinkHistory: DrinkRecord[],
        now: number = Date.now(),
        profile: NutritionProfile = DEFAULT_NUTRITION_PROFILE
    ): CalciumBalanceEvaluation {
        const rollingStart = now - (24 * 60 * 60 * 1000);
        const recentDrinks = (drinkHistory || []).filter(d => d.timestamp >= rollingStart && d.timestamp <= now);

        const dailyCaffeineMg = recentDrinks.reduce((sum, d) => sum + Math.max(0, d.caffeineMg), 0);
        const milkServingsCount = recentDrinks.filter(d => d.hasMilk || (d.drinkId && ['latte', 'cappuccino', 'cortado_macchiato'].includes(d.drinkId))).length;

        const estimatedUrinaryCaLossMg = Math.round(((dailyCaffeineMg / 175) * 6) * 10) / 10;
        // 1 porsiyon sütlü içecekteki (~120 ml süt ≈ 145 mg diyet Ca, ~%30 emilim) ~40 mg net emilen Ca sağlar
        const estimatedMilkCaOffsetMg = milkServingsCount * 40;
        const netCalciumDeltaMg = Math.round((estimatedMilkCaOffsetMg - estimatedUrinaryCaLossMg) * 10) / 10;

        const isLowDietaryCa = profile.calciumIntakeLevel === 'low' || profile.dietType === 'vegan';
        const isHighSensitivity = profile.specialCondition === 'postmenopausal';

        let vdrSuppressionRisk: 'NONE' | 'MODERATE' | 'HIGH' = 'NONE';
        if (dailyCaffeineMg >= 300) {
            if (isLowDietaryCa || isHighSensitivity) {
                vdrSuppressionRisk = netCalciumDeltaMg < 0 ? 'HIGH' : 'MODERATE';
            } else if (profile.calciumIntakeLevel === 'moderate' && netCalciumDeltaMg < -8) {
                vdrSuppressionRisk = 'MODERATE';
            }
        }

        const headline = vdrSuppressionRisk === 'HIGH'
            ? `🦴 Negatif Kalsiyum & VDR Riski (~-${estimatedUrinaryCaLossMg} mg idrar Ca kaybı)`
            : vdrSuppressionRisk === 'MODERATE'
                ? `⚡ Kafein Kaynaklı Kalsiyum Atılımı (~-${estimatedUrinaryCaLossMg} mg Ca)`
                : `🟢 Kalsiyum Dengesi Korunuyor (~-${estimatedUrinaryCaLossMg} mg idrar atılımı)`;

        const detail = vdrSuppressionRisk === 'HIGH'
            ? `Son 24 saatte ${dailyCaffeineMg} mg kafein (>300 mg eşiği) böbrek tübüler Ca/Mg geri emilimini azaltır ve D Vitamini Reseptörü (VDR) ekspresyonunu baskılar. Düşük kalsiyum (<600 mg/gün) veya postmenopoz profilinde günlük kalsiyumu >800 mg'a çıkarmanız önerilir.`
            : profile.calciumIntakeLevel === 'adequate' || estimatedMilkCaOffsetMg >= estimatedUrinaryCaLossMg
                ? `Günlük yeterli kalsiyum (>800 mg/gün) veya süt ilavesi, kafeinin yarattığı üriner kalsiyum kaybını tamamen telafi eder.`
                : `Her 175 mg kafein yaklaşık 6 mg net kalsiyum kaybına yol açar; bu etkiye karşı böbreklerde tolerans gelişmez.`;

        return {
            dailyCaffeineMg,
            estimatedUrinaryCaLossMg,
            milkServingsCount,
            estimatedMilkCaOffsetMg,
            netCalciumDeltaMg,
            vdrSuppressionRisk,
            headline,
            detail
        };
    }

    /**
     * Hem öğün/takviye emilim pencerelerini hem de kullanıcının uyku eşiğini birleştirerek
     * "Sonraki Optimal İçecek Zamanı" önerisini üretir.
     * Öğün girilmemişse hiçbir yapay bekleme eklemez!
     */
    getNextOptimalDrinkWindow(
        now: number,
        drink: Drink,
        serving: ServingOption,
        hasAddedMilk: boolean,
        meals: MealRecord[] = [],
        supplements: SupplementRecord[] = [],
        profile: NutritionProfile = DEFAULT_NUTRITION_PROFILE,
        targetBedtimeMs?: number,
        projectedSleepReadyMs?: number
    ): OptimalWindowSuggestion {
        const evalNow = this.evaluateDrinkCandidate(drink, serving, now, hasAddedMilk, meals, supplements, profile);

        const activeBlockingCollisions = evalNow.collisions.filter(
            c => (c.severity === 'HIGH' || c.severity === 'MODERATE') && c.waitMoreMinutes > 0
        );

        if (activeBlockingCollisions.length === 0) {
            const exceedsBedtime = Boolean(targetBedtimeMs && projectedSleepReadyMs && projectedSleepReadyMs > targetBedtimeMs);
            return {
                isImmediateSafeForMeals: true,
                mealSafeTimestamp: now,
                waitMinutesForMeals: 0,
                blockingTargetLabel: null,
                exceedsSleepCutoffIfDrunkAtSafeTime: exceedsBedtime,
                recommendationText: evalNow.hasMealOrSupplementData
                    ? '✅ Emilim penceresi açık: Öğün/takviye blokajı olmadan şimdi tüketilebilir.'
                    : '✅ Aktif öğün kısıtlaması yok (İsteğe bağlı öğün eklerseniz emilim penceresi otomatik hesaplanır).'
            };
        }

        // En uzun bekleme gerektiren öğün/takviye çakışmasını bul
        const maxCollision = activeBlockingCollisions.reduce((prev, curr) =>
            curr.waitMoreMinutes > prev.waitMoreMinutes ? curr : prev
        );

        const mealSafeTimestamp = now + (maxCollision.waitMoreMinutes * 60 * 1000);
        const shiftMs = mealSafeTimestamp - now;
        const shiftedSleepReady = projectedSleepReadyMs ? projectedSleepReadyMs + shiftMs : undefined;
        const exceedsBedtime = Boolean(targetBedtimeMs && shiftedSleepReady && shiftedSleepReady > targetBedtimeMs);

        const safeDate = new Date(mealSafeTimestamp);
        const timeStr = `${safeDate.getHours().toString().padStart(2, '0')}:${safeDate.getMinutes().toString().padStart(2, '0')}`;

        return {
            isImmediateSafeForMeals: false,
            mealSafeTimestamp,
            waitMinutesForMeals: maxCollision.waitMoreMinutes,
            blockingTargetLabel: maxCollision.targetLabel,
            exceedsSleepCutoffIfDrunkAtSafeTime: exceedsBedtime,
            recommendationText: `⏳ ${maxCollision.targetLabel} emilimi için en uygun saat: ${timeStr} (${maxCollision.waitMoreMinutes} dk sonra).`
        };
    }
}
