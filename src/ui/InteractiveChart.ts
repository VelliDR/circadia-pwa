import Chart from 'chart.js/auto';
import { Pharmacokinetics } from '../engine/Pharmacokinetics';
import { DrinkRecord } from '../store/db';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

export class InteractiveChart {
    canvas: HTMLCanvasElement | null;
    chartInstance: Chart | null;
    currentThemeIsRedShift: boolean | null;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.chartInstance = null;
        this.currentThemeIsRedShift = null;
    }

    render(
        pkEngine: Pharmacokinetics,
        drinkHistory: DrinkRecord[],
        cigsPerDay: number,
        thresholdMg: number,
        sleepThresholdMg: number = 20,
        isQuit: boolean = false,
        daysQuit: number = 0,
        priorCigs: number = 20,
        isOCP: boolean = false
    ) {
        if (!this.canvas) return;

        const isRedShift = document.body.classList.contains('red-shift');
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

        const labels = [];
        const data = [];
        
        const stepMinutes = 10;
        const totalSteps = (hoursWindow * 60) / stepMinutes;

        for (let i = 0; i <= totalSteps; i++) {
            const t = startTime + (i * stepMinutes * 60 * 1000);
            const val = pkEngine.getTotalActiveCaffeine(drinkHistory, t, cigsPerDay, isQuit, daysQuit, priorCigs, isOCP);
            labels.push(t);
            data.push(val);
        }

        // Eğer grafik varsa ve tema değişmediyse grafiği yok etmeden yerinde güncelle
        if (this.chartInstance && this.currentThemeIsRedShift === isRedShift) {
            this.chartInstance.data.labels = labels;
            this.chartInstance.data.datasets[0].data = data;
            
            const scales = this.chartInstance.options.scales as any;
            if (scales && scales.x) {
                scales.x.min = startTime;
                scales.x.max = endTime;
            }

            const plugins = this.chartInstance.options.plugins as any;
            if (plugins && plugins.annotation && plugins.annotation.annotations) {
                const ann = plugins.annotation.annotations;
                if (ann.nowLine) {
                    ann.nowLine.xMin = now;
                    ann.nowLine.xMax = now;
                }
                if (ann.thresholdLine) {
                    ann.thresholdLine.yMin = thresholdMg;
                    ann.thresholdLine.yMax = thresholdMg;
                }
                if (ann.sleepLine) {
                    ann.sleepLine.yMin = sleepThresholdMg;
                    ann.sleepLine.yMax = sleepThresholdMg;
                }
            }

            this.chartInstance.update('none');
            return;
        }

        const config: any = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Kandaki Kafein (mg)',
                    data: data,
                    borderColor: colors.line,
                    backgroundColor: (context: any) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
                        gradient.addColorStop(0, colors.fillStart);
                        gradient.addColorStop(1, colors.fillEnd);
                        return gradient;
                    },
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
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
                                return ` ${Math.round(context.parsed.y)} mg`;
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            nowLine: {
                                type: 'line',
                                xMin: now,
                                xMax: now,
                                borderColor: isRedShift ? '#ff0000' : '#38bdf8',
                                borderWidth: 2,
                                borderDash: [2, 2],
                                label: {
                                    display: true,
                                    content: 'ŞİMDİ',
                                    position: 'start',
                                    backgroundColor: isRedShift ? '#ff0000' : '#38bdf8',
                                    color: '#000000',
                                    font: { size: 9, weight: 'bold' }
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
                                    content: 'Uyarılma Eşiği',
                                    position: 'start',
                                    backgroundColor: 'transparent',
                                    color: '#ef4444'
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
                                    content: 'Uyku Eşiği',
                                    position: 'start',
                                    backgroundColor: 'transparent',
                                    color: '#eab308'
                                }
                            }
                        }
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
                            stepSize: 4 * 60 * 60 * 1000,
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
                            callback: (value: any) => value + 'mg'
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
    }
}
