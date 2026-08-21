/**
 * @file ToleranceEngine.js
 * @description Kullanıcının kafein toleransı, aktif uyarılma (odak) eşiği,
 * adenozin rebound/yoksunluk riski ve klinik toksisite seviyelerini yönetir.
 */

export type ToleranceKey = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ToleranceLevel {
    id: ToleranceKey;
    name: string;
    thresholdMg: number;
    description: string;
}

export const TOLERANCE_LEVELS: Record<ToleranceKey, ToleranceLevel> = {
    LOW: {
        id: 'LOW',
        name: 'Duyarlı / Seyrek İçici',
        thresholdMg: 25,
        description: 'Düşük kafein miktarları bile güçlü uyarılma sağlar.'
    },
    MEDIUM: {
        id: 'MEDIUM',
        name: 'Standart (Günde 1-2 Fincan)',
        thresholdMg: 45,
        description: 'Ortalama tolerans seviyesi.'
    },
    HIGH: {
        id: 'HIGH',
        name: 'Yüksek / Nöbetçi Modu (Günde 3+ Fincan)',
        thresholdMg: 85,
        description: 'Adenozin reseptör regülasyonu artmıştır. Düşük dozlar etki etmez.'
    }
};

export interface HealthRiskLevel {
    level: string;
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
        message: 'Kandaki kafein miktarı günlük önerilen fizyolojik sınırlar dahilinde.'
    },
    WARNING: {
        level: 'WARNING',
        title: '⚡ Günlük Azami Limit Aşıldı (400 mg+)',
        color: '#eab308',
        bgColor: 'rgba(234, 179, 8, 0.15)',
        borderColor: '#ca8a04',
        message: 'FDA/EFSA önerilen günlük 400 mg sınırını aştınız. Uykusuzluk, sinirlilik ve hafif çarpıntı yaşanabilir.'
    },
    HIGH_RISK: {
        level: 'HIGH_RISK',
        title: '⚠️ Yüksek Toksisite Riski (600 mg+)',
        color: '#f97316',
        bgColor: 'rgba(249, 115, 22, 0.2)',
        borderColor: '#ea580c',
        message: 'Kandaki kafein düzeyi aşırı yüksek. Taşikardi (hızlı nabız), ellerde titreme (tremor) ve mide rahatsızlığı görülebilir.'
    },
    CRITICAL: {
        level: 'CRITICAL',
        title: '🚨 AKUT TOKSİSİTE / MEDİKAL UYARI (1000 mg+)',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.25)',
        borderColor: '#dc2626',
        message: 'Kandaki kafein miktarı kritik boyutta! Şiddetli aritmi, bulantı, ajitasyon ve nöbet riski mevcuttur. DERHAL kafein alımını durdurun!'
    }
};

export class ToleranceEngine {
    currentTolerance: ToleranceLevel;

    constructor(userToleranceKey: ToleranceKey = 'MEDIUM') {
        this.currentTolerance = TOLERANCE_LEVELS[userToleranceKey] || TOLERANCE_LEVELS.MEDIUM;
    }

    /**
     * Tolerans seviyesini günceller.
     * @param {ToleranceKey} toleranceKey - 'LOW', 'MEDIUM' veya 'HIGH'
     */
    setTolerance(toleranceKey: ToleranceKey) {
        if (TOLERANCE_LEVELS[toleranceKey]) {
            this.currentTolerance = TOLERANCE_LEVELS[toleranceKey];
        }
    }

    /**
     * Kandaki kafein miktarına göre kullanıcının aktif odak/uyarılma durumunu döner.
     * @param {number} activeCaffeineMg - Kandaki anlık aktif kafein
     */
    getStimulationStatus(activeCaffeineMg: number) {
        const threshold = this.currentTolerance.thresholdMg;
        return {
            isStimulated: activeCaffeineMg >= threshold,
            thresholdMg: threshold,
            deficitMg: Math.max(0, Math.round(threshold - activeCaffeineMg))
        };
    }

    /**
     * Son alımdan bu yana geçen süreye ve kafeinin çekilmesine bağlı olarak adenozin rebound riskini hesaplar.
     * @param {number} activeCaffeineMg 
     * @param {number} lastDrinkTimestamp 
     */
    checkWithdrawalRisk(activeCaffeineMg: number, lastDrinkTimestamp: number | null) {
        if (!lastDrinkTimestamp) return { risk: 'NONE', message: 'Tüketim kaydı yok.' };

        const hoursSinceLastDrink = (Date.now() - lastDrinkTimestamp) / (1000 * 60 * 60);

        if (activeCaffeineMg < 10 && hoursSinceLastDrink >= 14 && this.currentTolerance.id === 'HIGH') {
            return {
                risk: 'HIGH',
                message: '⚠️ Adenozin Rebound Riski: Yüksek tolerans nedeniyle baş ağrısı ve sersemlik başlayabilir.'
            };
        } else if (activeCaffeineMg < 15 && hoursSinceLastDrink >= 12) {
            return {
                risk: 'MODERATE',
                message: '⚡ Kafein seviyesi düştü. Odak kaybı yaşanabilir.'
            };
        }

        return { risk: 'LOW', message: 'Kandaki kafein dengeli.' };
    }

    /**
     * Toksisite eşiklerine göre klinik sağlık durumunu döndürür.
     * @param {number} activeCaffeineMg
     * @param {number} weightKg
     */
    getHealthStatus(activeCaffeineMg: number, weightKg: number = 70): HealthRiskLevel {
        const mgPerKg = activeCaffeineMg / weightKg;

        if (mgPerKg >= 14.2) { // ~1000mg for 70kg
            return HEALTH_RISK_LEVELS.CRITICAL;
        } else if (mgPerKg >= 8.5) { // ~600mg for 70kg
            return HEALTH_RISK_LEVELS.HIGH_RISK;
        } else if (mgPerKg >= 5.7) { // ~400mg for 70kg
            return HEALTH_RISK_LEVELS.WARNING;
        }
        return HEALTH_RISK_LEVELS.SAFE;
    }
}