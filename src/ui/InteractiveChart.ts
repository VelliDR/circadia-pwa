import Chart from 'chart.js/auto';
import { Pharmacokinetics } from '../engine/Pharmacokinetics';
import { DrinkRecord, MealRecord, SupplementRecord } from '../store/db';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

export class InteractiveChart {
    canvas: HTMLCanvasElement | null;
    chartInstance: Chart | null;
    currentThemeIsRedShift: boolean | null;
    currentIsCompact: boolean | null;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.chartInstance = null;
        this.currentThemeIsRedShift = null;
        this.currentIsCompact = null;
    }

    private isCompactViewport(): boolean {
        return typeof window !== 'undefined' && window.innerWidth < 520;
    }

    private buildAnnotations(
        now: number,
        startTime: number,
        endTime: number,
        thresholdMg: number,
        sleepThresholdMg: number,
        isRedShift: boolean,
        isCompact: boolean,
        meals: MealRecord[],
        supplements: SupplementRecord[]
    ): Record<string, any> {
        const annotations: Record<string, any> = {
            nowLine: {
                type: 'line',
                xMin: now,
                xMax: now,
                borderColor: isRedShift ? '#ff0000' : '#38bdf8',
                borderWidth: isCompact ? 1.5 : 2,
                borderDash: [2, 2],
                label: {
                    display: true,
                    content: 'ŞİMDİ',
                    position: 'start',
                    backgroundColor: isRedShift ? '#ff0000' : '#38bdf8',
                    color: '#000000',
                    padding: { x: 4, y: 2 },
                    font: { size: isCompact ? 8 : 9, weight: 'bold' }
                }
            },
            thresholdLine: {
                type: 'line',
                yMin: thresholdMg,
                yMax: thresholdMg,
                borderColor: '#ef4444',
                borderWidth: 1,
                borderDash: [4, 4],
                label: {
                    display: true,
                    content: isCompact ? `Odak (${thresholdMg})` : 'Uyarılma Eşiği',
                    position: 'start',
                    backgroundColor: 'transparent',
                    color: '#ef4444',
                    font: { size: isCompact ? 9 : 10, weight: '600' }
                }
            },
            sleepLine: {
                type: 'line',
                yMin: sleepThresholdMg,
                yMax: sleepThresholdMg,
                borderColor: '#eab308',
                borderWidth: 1,
                borderDash: [4, 4],
                label: {
                    display: true,
                    content: isCompact ? `Uyku (${sleepThresholdMg})` : 'Uyku Eşiği',
                    position: 'start',
                    backgroundColor: 'transparent',
                    color: '#eab308',
                    font: { size: isCompact ? 9 : 10, weight: '600' }
                }
            }
        };

        // İsteğe bağlı öğün pencereleri (-60 dk .. +120 dk)
        meals.forEach((meal, idx) => {
            const winStart = meal.timestamp - (60 * 60 * 1000);
            const winEnd = meal.timestamp + (120 * 60 * 1000);
            if (winEnd < startTime || winStart > endTime) return;

            const isAnimal = meal.matrixType === 'animal';
            const boxBg = isRedShift
                ? (isAnimal ? 'rgba(255, 80, 80, 0.05)' : 'rgba(255, 51, 0, 0.14)')
                : (isAnimal ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.12)');
            const borderCol = isRedShift
                ? 'rgba(255, 77, 77, 0.35)'
                : (isAnimal ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.45)');

            annotations[`mealWindow_${idx}`] = {
                type: 'box',
                xMin: Math.max(startTime, winStart),
                xMax: Math.min(endTime, winEnd),
                backgroundColor: boxBg,
                borderColor: borderCol,
                borderWidth: 1
            };

            if (meal.timestamp >= startTime && meal.timestamp <= endTime) {
                const shortMealName = meal.label.split(' (')[0];
                annotations[`mealLine_${idx}`] = {
                    type: 'line',
                    xMin: meal.timestamp,
                    xMax: meal.timestamp,
                    borderColor: borderCol,
                    borderWidth: 1.5,
                    borderDash: [3, 3],
                    label: {
                        display: true,
                        content: isCompact ? `🍽️ ${shortMealName}` : `🍽️ ${meal.label}`,
                        position: 'end',
                        backgroundColor: isRedShift ? 'rgba(30, 0, 0, 0.85)' : 'rgba(15, 23, 42, 0.85)',
                        color: isRedShift ? '#ff9999' : '#fbbf24',
                        padding: { x: 4, y: 2 },
                        font: { size: isCompact ? 8 : 9, weight: 'bold' }
                    }
                };
            }
        });

        // İsteğe bağlı takviye pencereleri (-60 dk .. +120 dk)
        supplements.forEach((supp, idx) => {
            const winStart = supp.timestamp - (60 * 60 * 1000);
            const winEnd = supp.timestamp + (120 * 60 * 1000);
            if (winEnd < startTime || winStart > endTime) return;

            const boxBg = isRedShift ? 'rgba(255, 0, 0, 0.16)' : 'rgba(239, 68, 68, 0.11)';
            const borderCol = isRedShift ? 'rgba(255, 51, 51, 0.45)' : 'rgba(248, 113, 113, 0.5)';

            annotations[`suppWindow_${idx}`] = {
                type: 'box',
                xMin: Math.max(startTime, winStart),
                xMax: Math.min(endTime, winEnd),
                backgroundColor: boxBg,
                borderColor: borderCol,
                borderWidth: 1
            };

            if (supp.timestamp >= startTime && supp.timestamp <= endTime) {
                const shortSuppName = supp.label.split(' (')[0];
                annotations[`suppLine_${idx}`] = {
                    type: 'line',
                    xMin: supp.timestamp,
                    xMax: supp.timestamp,
                    borderColor: borderCol,
                    borderWidth: 1.5,
                    borderDash: [2, 3],
                    label: {
                        display: true,
                        content: isCompact ? `💊 ${shortSuppName}` : `💊 ${supp.label}`,
                        position: 'end',
                        backgroundColor: isRedShift ? 'rgba(40, 0, 0, 0.85)' : 'rgba(15, 23, 42, 0.85)',
                        color: isRedShift ? '#ff8080' : '#fca5a5',
                        padding: { x: 4, y: 2 },
                        font: { size: isCompact ? 8 : 9, weight: 'bold' }
                    }
                };
            }
        });

        return annotations;
    }

    render(
        pkEngine: Pharmacokinetics,
        drinkHistory: DrinkRecord[],
        cigsPerDay: number,
        thresholdMg: number,
        sleepThresholdMg: number = 25,
        isQuit: boolean = false,
        daysQuit: number = 0,
        priorCigs: number = 20,
        isOCP: boolean = false,
        isPregnant: boolean = false,
        meals: MealRecord[] = [],
        supplements: SupplementRecord[] = []
    ) {
        if (!this.canvas) return;

        const isRedShift = document.body.classList.contains('red-shift');
        const isCompact = this.isCompactViewport();
        const colors = {
            line: isRedShift ? '#ff1a1a' : '#10b981',
            fillStart: isRedShift ? 'rgba(255, 26, 26, 0.35)' : 'rgba(16, 185, 129, 0.35)',
            fillEnd: isRedShift ? 'rgba(255, 26, 26, 0.0)' : 'rgba(16, 185, 129, 0.0)',
            gridLine: isRedShift ? 'rgba(255, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)',
            axisText: isRedShift ? '#ff8080' : '#64748b'
        };

        const now = Date.now();
        const hoursWindow = 24;
        const startTime = now - (12 * 60 * 60 * 1000);
        const endTime = now + (12 * 60 * 60 * 1000);

        const labels: number[] = [];
        const data: number[] = [];

        const stepMinutes = 10;
        const totalSteps = (hoursWindow * 60) / stepMinutes;

        for (let i = 0; i <= totalSteps; i++) {
            const t = startTime + (i * stepMinutes * 60 * 1000);
            const val = pkEngine.getTotalActiveCaffeine(
                drinkHistory,
                t,
                cigsPerDay,
                isQuit,
                daysQuit,
                priorCigs,
                isOCP,
                isPregnant
            );
            labels.push(t);
            data.push(val);
        }

        const annotations = this.buildAnnotations(
            now,
            startTime,
            endTime,
            thresholdMg,
            sleepThresholdMg,
            isRedShift,
            isCompact,
            meals,
            supplements
        );

        // Eğer grafik varsa ve tema / kompakt mod değişmediyse yerinde güncelle
        if (this.chartInstance && this.currentThemeIsRedShift === isRedShift && this.currentIsCompact === isCompact) {
            this.chartInstance.data.labels = labels;
            this.chartInstance.data.datasets[0].data = data;

            const scales = this.chartInstance.options.scales as any;
            if (scales && scales.x) {
                scales.x.min = startTime;
                scales.x.max = endTime;
            }

            const plugins = this.chartInstance.options.plugins as any;
            if (plugins && plugins.annotation) {
                plugins.annotation.annotations = annotations;
            }

            this.chartInstance.update('none');
            return;
        }

        const config: any = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Aktif Vücut Yükü (mg)',
                    data: data,
                    borderColor: colors.line,
                    backgroundColor: (context: any) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height || 240);
                        gradient.addColorStop(0, colors.fillStart);
                        gradient.addColorStop(1, colors.fillEnd);
                        return gradient;
                    },
                    borderWidth: isCompact ? 2 : 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 8, right: 6, bottom: 2, left: 2 }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (context: any) => {
                                const d = new Date(context[0].parsed.x);
                                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            },
                            label: (context: any) => {
                                return ` ${Math.round(context.parsed.y)} mg aktif yük`;
                            }
                        }
                    },
                    annotation: {
                        annotations
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: startTime,
                        max: endTime,
                        grid: {
                            color: colors.gridLine
                        },
                        ticks: {
                            color: colors.axisText,
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: isCompact ? 6 : 8,
                            stepSize: 4 * 60 * 60 * 1000,
                            font: { size: isCompact ? 10 : 11 },
                            callback: (value: any) => {
                                const d = new Date(value);
                                return d.getHours().toString().padStart(2, '0') + ':00';
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: colors.gridLine
                        },
                        ticks: {
                            color: colors.axisText,
                            maxTicksLimit: isCompact ? 5 : 6,
                            font: { size: isCompact ? 10 : 11 },
                            callback: (value: any) => value + ' mg'
                        }
                    }
                }
            }
        };

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        this.chartInstance = new Chart(this.canvas, config);
        this.currentThemeIsRedShift = isRedShift;
        this.currentIsCompact = isCompact;
    }
}
