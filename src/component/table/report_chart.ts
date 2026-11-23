import { ChangeDetectionStrategy, Component, computed, input, ViewEncapsulation } from "@angular/core";
import { ChartKind } from "../../model/appdata";
import { titleCase } from "../../util/text";

const WIDTH = 640;
const HEIGHT = 260;
const PLOT = { left: 64, right: 632, top: 12, bottom: 224 };
const PIE = { cx: 130, cy: 130, r: 118 };
/** Rows a bar or line chart plots; later rows stay in the report's table only. */
const MAX_POINTS = 200;
/** Pie slices before the rest fold into Other. */
const MAX_SLICES = 8;
const MAX_BAR_WIDTH = 24;
const MAX_AXIS_LABELS = 10;
const MAX_MARKERS = 40;

type Row = Record<string, unknown>;

/** One drawn value; `title` is its hover text. */
interface ChartMark {
    x: number;
    y: number;
    width: number;
    height: number;
    path: string;
    title: string;
}

interface ChartSeries {
    name: string;
    opacity: number;
    marks: ChartMark[];
    /** Line charts: the polyline through the marks. */
    line: string;
}

interface ChartLayout {
    series: ChartSeries[];
    /** Horizontal gridlines with their value labels. */
    ticks: { y: number; label: string }[];
    labels: { x: number; text: string }[];
    baseline: number;
    truncated: boolean;
}

/** Draws report rows as keel's bar, line or pie chart. Series take `color` from `.report-chart__series--<n>`. */
@Component({
    selector: 'sail-report-chart',
    templateUrl: './report_chart.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
export class ReportChart {
    readonly kind = input.required<ChartKind>();
    readonly rows = input<Row[]>([]);
    /** The column whose values name the groups or slices. */
    readonly category = input('');
    /** The plotted numeric columns. */
    readonly series = input<string[]>([]);
    /** Display text of `row[column]`, for hover text and axis labels. */
    readonly format = input<(column: string, row: Row) => unknown>((column, row) => row[column]);

    /** A pie is a fixed square; an axis chart fills its container's width. */
    protected readonly pie = computed(() => this.kind() === 'P');
    protected readonly viewBox = computed(() => `0 0 ${this.pie() ? HEIGHT : WIDTH} ${HEIGHT}`);
    protected readonly height = HEIGHT;
    protected readonly plot = PLOT;
    protected readonly maxMarkers = MAX_MARKERS;
    private readonly compact = new Intl.NumberFormat(undefined, { notation: 'compact' });

    readonly description = computed(() => {
        const kind = { N: '', B: 'Bar chart', L: 'Line chart', P: 'Pie chart' }[this.kind()];
        return `${kind} of ${this.series().map(titleCase).join(', ')} by ${titleCase(this.category())}`;
    });

    readonly layout = computed<ChartLayout | null>(() => {
        if (!this.rows().length || !this.series().length || !this.category()) return null;
        return this.kind() === 'P' ? this.pieLayout() : this.kind() === 'N' ? null : this.axisLayout();
    });

    /** A finite number from a cell (keel sends 64-bit integers as strings), else null. */
    private value(row: Row, column: string): number | null {
        const raw = row[column];
        if (raw === null || raw === undefined || raw === '') return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }

    private text(column: string, row: Row): string {
        const shown = this.format()(column, row);
        return typeof shown === 'number' ? this.compact.format(shown) : String(shown ?? '');
    }

    private opacity(index: number, count: number): number {
        return count < 2 ? 1 : Math.round((1 - 0.7 * index / (count - 1)) * 100) / 100;
    }

    /** A step of 1, 2 or 5 times a power of ten giving about four gridlines. */
    private tickStep(span: number): number {
        const rough = span / 4;
        const power = 10 ** Math.floor(Math.log10(rough));
        return power * ([1, 2, 5].find((m) => m * power >= rough) ?? 10);
    }

    private axisLayout(): ChartLayout {
        const rows = this.rows().slice(0, MAX_POINTS);
        const columns = this.series();
        const bars = this.kind() === 'B';
        const values = columns.map((column) => rows.map((row) => this.value(row, column)));
        const known = values.flat().filter((v): v is number => v !== null);
        let low = Math.min(0, ...known), high = Math.max(0, ...known);
        if (low === high) high = low + 1;
        const step = this.tickStep(high - low);
        low = Math.floor(low / step) * step;
        high = Math.ceil(high / step) * step;
        const y = (v: number) => PLOT.top + (high - v) / (high - low) * (PLOT.bottom - PLOT.top);
        const band = (PLOT.right - PLOT.left) / rows.length;
        const barWidth = Math.min(MAX_BAR_WIDTH, band * 0.8 / columns.length);
        // Tick labels borrow the row of the largest value, so a money column shows its currency.
        const peak = rows[values[0].indexOf(Math.max(...values[0].map((v) => v ?? -Infinity)))] ?? rows[0];

        const ticks = [];
        for (let v = low; v <= high + step / 2; v += step) {
            ticks.push({ y: y(v), label: this.text(columns[0], { ...peak, [columns[0]]: v }) });
        }
        const every = Math.ceil(rows.length / MAX_AXIS_LABELS);
        const labels = rows.map((row, i) => ({ x: PLOT.left + (i + 0.5) * band, text: this.clip(this.text(this.category(), row)) }))
            .filter((_, i) => i % every === 0);

        const series = columns.map((column, s) => {
            const marks: ChartMark[] = [];
            values[s].forEach((v, i) => {
                if (v === null) return;
                const center = PLOT.left + (i + 0.5) * band;
                const x = bars ? center + (s - columns.length / 2) * barWidth + 1 : center;
                marks.push({
                    x, y: bars ? Math.min(y(v), y(0)) : y(v),
                    width: Math.max(barWidth - 2, 1), height: Math.abs(y(v) - y(0)), path: '',
                    title: `${this.text(this.category(), rows[i])} · ${titleCase(column)}: ${this.text(column, rows[i])}`,
                });
            });
            return {
                name: titleCase(column), opacity: this.opacity(s, columns.length), marks,
                line: bars ? '' : marks.map((m) => `${m.x},${m.y}`).join(' '),
            };
        });
        return { series, ticks, labels, baseline: y(0), truncated: this.rows().length > rows.length };
    }

    /** One series per slice; values that are not positive have no slice. */
    private pieLayout(): ChartLayout {
        const column = this.series()[0];
        const slices = this.rows()
            .map((row) => ({ name: this.text(this.category(), row), value: this.value(row, column) ?? 0, shown: this.text(column, row) }))
            .filter((slice) => slice.value > 0);
        const rest = slices.splice(MAX_SLICES);
        if (rest.length) {
            const value = rest.reduce((sum, slice) => sum + slice.value, 0);
            slices.push({ name: 'Other', value, shown: this.compact.format(value) });
        }
        const total = slices.reduce((sum, slice) => sum + slice.value, 0);
        const point = (turn: number) => {
            const angle = turn * 2 * Math.PI - Math.PI / 2;
            return `${PIE.cx + PIE.r * Math.cos(angle)} ${PIE.cy + PIE.r * Math.sin(angle)}`;
        };
        let start = 0;
        const series = slices.map((slice, i) => {
            // A full circle has coincident arc ends and would not draw.
            const share = Math.min(slice.value / total, 0.9999);
            const path = `M${PIE.cx} ${PIE.cy} L${point(start)} A${PIE.r} ${PIE.r} 0 ${share > 0.5 ? 1 : 0} 1 ${point(start + share)} Z`;
            start += share;
            const title = `${slice.name}: ${slice.shown} (${Math.round(slice.value / total * 100)}%)`;
            return { name: title, opacity: this.opacity(i, slices.length), line: '', marks: [{ x: 0, y: 0, width: 0, height: 0, path, title }] };
        });
        return { series, ticks: [], labels: [], baseline: 0, truncated: false };
    }

    private clip(text: string): string {
        return text.length > 14 ? text.slice(0, 13) + '…' : text;
    }
}
