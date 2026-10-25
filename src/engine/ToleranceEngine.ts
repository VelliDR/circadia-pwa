/**
 * @file ToleranceEngine.ts
 * @description Kullanıcının kafein toleransı, aktif uyarılma (odak) eşiği,
 * adenozin rebound/yoksunluk riski, EFSA tek doz / günlük kümülatif alım limitleri
 * ve plazma konsantrasyonu (mg/L) bazlı klinik toksisite seviyelerini yönetir.
 */

import { DrinkRecord } from '../store/db';
import { CAFFEINE_VD_L_PER_KG } from './Pharmacokinetics';

export type ToleranceKey = 'LOW' | 'MEDIUM' | 'HIGH';
export type DailyWindowMode = 'midnight' | 'rolling24h';

export interface ToleranceLevel {
    id: ToleranceKey;
    name: string;
    thresholdMg: number;
    sleepThresholdMg: number;
    description: string;
}

export const TOLERANCE_LEVELS: Record<ToleranceKey, ToleranceLevel> = {
    LOW: {
        id: 'LOW',
        name: 'Duyarlı / Seyrek İçici',
        thresholdMg: 25,
        sleepThresholdMg: 15,
        description: 'Düşük kafein miktarları bile güçlü uyarılma sağlar.'
    },
    MEDIUM: {
        id: 'MEDIUM',
        name: 'Standart (Günde 1-2 Fincan)',
        thresholdMg: 45,
        sleepThresholdMg: 25,
        description: 'Ortalama tolerans seviyesi.'
    },
    HIGH: {
        id: 'HIGH',
        name: 'Yüksek / Nöbetçi Modu (Günde 3+ Fincan)',
        thresholdMg: 85,
        sleepThresholdMg: 40,
        description: 'Adenozin reseptör regülasyonu artmıştır. Düşük dozlar etki etmez.'
    }
};

export interface HealthRiskLevel {
    level: 'SAFE' | 'WARNING' | 'HIGH_RISK' | 'CRITICAL';
    title: string;
    color: string;
    bgColor: string;
    borderColor: string;
    message: string;
}

export const HEALTH_RISK_LEVELS: Record<string, HealthRiskLevel> = {
    SAFE: {
        level: 'SAFE',
        title: '🟢 Güvenli Bölge',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: '#10b981',
        message: 'Aktif vücut kafein yükü ve günlük alım fizyolojik sınırlar dahilinde.'
    },
    WARNING: {
        level: 'WARNING',
        title: '⚡ Günlük Azami Alım Sınırı Aşıldı (400 mg+)',
        color: '#eab308',
        bgColor: 'rgba(234, 179, 8, 0.15)',
        borderColor: '#ca8a04',
        message: 'FDA/EFSA önerilen günlük 400 mg kümülatif alım sınırını aştınız. Uykusuzluk, huzursuzluk ve hafif çarpıntı görülebilir.'
    },
    BODY_LOAD_WARNING: {
        level: 'WARNING',
        title: '⚡ Yüksek Anlık Sistemik Yük (~9+ mg/L Plazma)',
        color: '#eab308',
        bgColor: 'rgba(234, 179, 8, 0.15)',
        borderColor: '#ca8a04',
        message: 'Vücuttaki anlık aktif kafein yükü yüksek (~5.7+ mg/kg). Ek doz almadan önce eliminasyon için bekleyiniz.'
    },
    PREGNANCY_WARNING: {
        level: 'WARNING',
        title: '🤰 Gebelik Günlük Kafein Sınırı Aşıldı (200 mg+)',
        color: '#f97316',
        bgColor: 'rgba(249, 115, 22, 0.18)',
        borderColor: '#ea580c',
        message: 'EFSA/ACOG kılavuzlarına göre gebelikte günlük toplam kafein alımı 200 mg altında tutulmalıdır.'
    },
    HIGH_RISK: {
        level: 'HIGH_RISK',
        title: '⚠️ Yüksek Toksisite Riski (~13+ mg/L Plazma)',
        color: '#f97316',
        bgColor: 'rgba(249, 115, 22, 0.2)',
        borderColor: '#ea580c',
        message: 'Sistemik aktif kafein yükü çok yüksek (~8.5+ mg/kg). Taşikardi, ellerde titreme (tremor) ve mide rahatsızlığı görülebilir.'
    },
    CRITICAL: {
        level: 'CRITICAL',
        title: '🚨 AKUT TOKSİSİTE / MEDİKAL UYARI (~22+ mg/L Plazma)',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.25)',
        borderColor: '#dc2626',
        message: 'Vücuttaki aktif kafein yükü kritik boyutta (~14.2+ mg/kg)! Şiddetli aritmi, bulantı, ajitasyon ve nöbet riski mevcuttur. DERHAL kafein alımını durdurun!'
    }
};

export interface SingleDoseCheck {
    exceedsLimit: boolean;
    limitMg: number;
    message: string | null;
}

export class ToleranceEngine {
    currentTolerance: ToleranceLevel;

    constructor(userToleranceKey: ToleranceKey = 'MEDIUM') {
        this.currentTolerance = TOLERANCE_LEVELS[userToleranceKey] || TOLERANCE_LEVELS.MEDIUM;
    }

    setTolerance(toleranceKey: ToleranceKey) {
        if (TOLERANCE_LEVELS[toleranceKey]) {
            this.currentTolerance = TOLERANCE_LEVELS[toleranceKey];
        }
    }

    getStimulationStatus(activeCaffeineMg: number) {
        const threshold = this.currentTolerance.thresholdMg;
        return {
            isStimulated: activeCaffeineMg >= threshold,
            thresholdMg: threshold,
            deficitMg: Math.max(0, Math.round(threshold - activeCaffeineMg))
        };
    }

    checkWithdrawalRisk(activeCaffeineMg: number, lastDrinkTimestamp: number | null) {
        if (!lastDrinkTimestamp) return { risk: 'NONE', message: 'Henüz kayıtlı kafeinli içecek yok.' };

        const hoursSinceLastDrink = (Date.now() - lastDrinkTimestamp) / (1000 * 60 * 60);

        if (activeCaffeineMg < 10 && hoursSinceLastDrink >= 14 && this.currentTolerance.id === 'HIGH') {
            return {
                risk: 'HIGH',
                message: '⚠️ Adenozin Rebound Riski: Yüksek tolerans nedeniyle baş ağrısı ve sersemlik başlayabilir.'
            };
        } else if (activeCaffeineMg < 15 && hoursSinceLastDrink >= 12) {
            return {
                risk: 'MODERATE',
                message: '⚡ Kafein çekilmesi: Odak kaybı ve hafif halsizlik hissedilebilir.'
            };
        } else if (activeCaffeineMg <= this.currentTolerance.sleepThresholdMg) {
            return {
                risk: 'LOW',
                message: '😴 Aktif yük güvenli uyku eşiğinin altında. Biyoritim dinlenme moduna uygun.'
            };
        }

        return { risk: 'STIMULATED', message: `⚡ Aktif uyarılma devam ediyor (Son alımdan ${hoursSinceLastDrink.toFixed(1)} sa geçti).` };
    }

    /**
     * EFSA (2015) tek seferlik güvenli doz kontrolü:
     * Sağlıklı yetişkinde min(200 mg, 3 mg/kg) üzeri tek dozlar uyarılır.
     */
    checkSingleDose(doseMg: number, weightKg: number = 70, isPregnant: boolean = false): SingleDoseCheck {
        const safeWeight = Math.max(30, Math.min(250, weightKg));
        const weightBasedLimit = Math.round(safeWeight * 3);
        const limitMg = isPregnant ? Math.min(150, weightBasedLimit) : Math.min(200, weightBasedLimit);

        if (doseMg > limitMg) {
            return {
                exceedsLimit: true,
                limitMg,
                message: isPregnant
                    ? `Gebelik profilinde tek seferde ${limitMg} mg üzeri kafein dozu önerilmez (Seçilen: ${doseMg} mg).`
                    : `EFSA tek seferlik güvenli doz sınırı (~${limitMg} mg / 3 mg·kg⁻¹) aşılıyor (${doseMg} mg).`
            };
        }
        return { exceedsLimit: false, limitMg, message: null };
    }

    /**
     * Gece yarısı (00:00) veya son 24 saatlik kayan pencere (nöbet/vardiya uyumlu) toplam kafein alımını hesaplar.
     */
    calculateCumulativeIntake(
        drinkHistory: DrinkRecord[],
        now: number = Date.now(),
        mode: DailyWindowMode = 'midnight'
    ): { midnightMg: number; rolling24hMg: number; activeWindowMg: number } {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayMs = startOfDay.getTime();
        const rolling24hStartMs = now - (24 * 60 * 60 * 1000);

        let midnightMg = 0;
        let rolling24hMg = 0;

        for (const d of drinkHistory) {
            if (d.caffeineMg <= 0 || d.timestamp > now) continue;
            if (d.timestamp >= startOfDayMs) midnightMg += d.caffeineMg;
            if (d.timestamp >= rolling24hStartMs) rolling24hMg += d.caffeineMg;
        }

        return {
            midnightMg,
            rolling24hMg,
            activeWindowMg: mode === 'rolling24h' ? rolling24hMg : midnightMg
        };
    }

    /**
     * Sistemik vücut yükü / plazma konsantrasyonu ve günlük kümülatif alım eşiklerine göre klinik durumu döndürür.
     */
    getHealthStatus(
        activeCaffeineMg: number,
        weightKg: number = 70,
        dailyTotalMg: number = 0,
        isPregnant: boolean = false
    ): HealthRiskLevel {
        const safeWeight = Math.max(30, Math.min(250, weightKg));
        const mgPerKg = activeCaffeineMg / safeWeight;
        const plasmaMgL = activeCaffeineMg / (CAFFEINE_VD_L_PER_KG * safeWeight);

        if (mgPerKg >= 14.2) { // ~21.8+ mg/L plazma (~1000 mg @ 70 kg)
            return {
                ...HEALTH_RISK_LEVELS.CRITICAL,
                title: `🚨 AKUT TOKSİSİTE / MEDİKAL UYARI (~${plasmaMgL.toFixed(1)} mg/L Plazma)`
            };
        } else if (mgPerKg >= 8.5) { // ~13.1+ mg/L plazma (~600 mg @ 70 kg)
            return {
                ...HEALTH_RISK_LEVELS.HIGH_RISK,
                title: `⚠️ Yüksek Toksisite Riski (~${plasmaMgL.toFixed(1)} mg/L Plazma)`
            };
        } else if (isPregnant && dailyTotalMg >= 200) {
            return HEALTH_RISK_LEVELS.PREGNANCY_WARNING;
        } else if (mgPerKg >= 5.7) { // ~8.8+ mg/L plazma (~400 mg anlık sistemik yük @ 70 kg)
            return HEALTH_RISK_LEVELS.BODY_LOAD_WARNING;
        } else if (dailyTotalMg >= 400) {
            return HEALTH_RISK_LEVELS.WARNING;
        }
        return HEALTH_RISK_LEVELS.SAFE;
    }
}