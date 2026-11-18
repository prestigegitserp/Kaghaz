export interface CutInput {
    stockWidth: number;
    stockHeight: number;
    pieceWidth: number;
    pieceHeight: number;
    margin: number;
    gap: number;
    grammage: number;
    rotate: boolean;
}

export interface CutBand {
    x: number;
    y: number;
    width: number;
    height: number;
    columns: number;
    rows: number;
    rotated: boolean;
}

export interface CutPlan {
    pieces: number;
    waste: number;
    grams: number;
    bands: CutBand[];
}

const fit = (size: number, piece: number, gap: number) => Math.floor((size + gap + 1e-8) / (piece + gap));

export function planCut(input: CutInput): CutPlan | undefined {
    const { stockWidth, stockHeight, pieceWidth, pieceHeight, margin, gap, grammage, rotate } = input;
    const measurements = [stockWidth, stockHeight, pieceWidth, pieceHeight];
    if (measurements.some(n => !Number.isFinite(n) || n < 10 || n > 2400)
        || !Number.isFinite(margin) || margin < 0 || margin > 1100
        || !Number.isFinite(gap) || gap < 0 || gap > 100
        || !Number.isFinite(grammage) || grammage < 1 || grammage > 1600) return;
    const innerWidth = stockWidth - 2 * margin, innerHeight = stockHeight - 2 * margin;
    if (innerWidth <= 0 || innerHeight <= 0) return;
    let best: CutBand[] = [], pieces = 0, rotatedPieces = 0;

    for (const across of [true, false]) {
        const width = across ? innerWidth : innerHeight, height = across ? innerHeight : innerWidth;
        const w = across ? pieceWidth : pieceHeight, h = across ? pieceHeight : pieceWidth;
        const columns = Math.max(0, fit(width, w, gap));
        const turnedColumns = rotate ? Math.max(0, fit(width, h, gap)) : 0;
        for (let rows = 0; rows <= (columns ? fit(height, h, gap) : 0); rows++) {
            const offset = rows * (h + gap);
            const turnedRows = turnedColumns ? Math.max(0, fit(height - offset, w, gap)) : 0;
            const turned = turnedRows * turnedColumns, total = rows * columns + turned;
            if (total < pieces || (total === pieces && turned >= rotatedPieces)) continue;
            const band = (y: number, a: number, b: number, nx: number, ny: number, rotated: boolean): CutBand =>
                across
                    ? { x: margin, y: y + margin, width: a, height: b, columns: nx, rows: ny, rotated }
                    : { x: y + margin, y: margin, width: b, height: a, columns: ny, rows: nx, rotated };
            best = [];
            if (rows) best.push(band(0, w, h, columns, rows, false));
            if (turnedRows) best.push(band(offset, h, w, turnedColumns, turnedRows, true));
            pieces = total;
            rotatedPieces = turned;
        }
    }

    return {
        pieces,
        waste: 100 * (1 - pieces * pieceWidth * pieceHeight / (stockWidth * stockHeight)),
        grams: grammage * pieces * pieceWidth * pieceHeight / 1_000_000,
        bands: best,
    };
}
