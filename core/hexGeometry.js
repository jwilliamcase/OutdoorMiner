import { BOARD } from '../constants.js';

// Axial coordinate conversions for pointy-top hexagons
export const HexGeometry = {
    // Convert pixel coordinates to hex coordinates
    pixelToHex(x, y, size) {
        // Use exact formulas from Red Blob Games
        const q = ((2/3 * x) / size);
        const r = ((-1/3 * x + Math.sqrt(3)/3 * y) / size);
        return this.axialRound(q, r);
    },

    // Round floating point hex coordinates to nearest hex
    axialRound(q, r) {
        let s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);

        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }

        return { q: rq, r: rr };
    },

    // Get pixel coordinates for hex center
    hexToPixel(q, r, size) {
        const x = size * (3/2 * q);
        const y = size * (Math.sqrt(3) * (r + q/2));
        return { x, y };
    },

    // Get vertices for a hex at given position
    getHexVertices(x, y, size) {
        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            vertices.push({
                x: x + size * Math.cos(angle),
                y: y + size * Math.sin(angle)
            });
        }
        return vertices;
    }
};
