import { BOARD } from '../constants.js';

export class HexService {
    // Pointy-top hex directions (clockwise from east)
    static DIRECTIONS = [
        { q: 1, r: 0 },    // East
        { q: 1, r: -1 },   // Northeast
        { q: 0, r: -1 },   // Northwest
        { q: -1, r: 0 },   // West
        { q: -1, r: 1 },   // Southwest
        { q: 0, r: 1 }     // Southeast
    ];

    // Convert pixel to hex coordinates
    static pixelToHex(x, y, size = BOARD.BASE_SIZE) {
        const q = (2/3 * x) / size;
        const r = (-1/3 * x + Math.sqrt(3)/3 * y) / size;
        return this.roundAxial(q, r);
    }

    // Get center pixel coordinates for a hex
    static hexToPixel(q, r, size = BOARD.BASE_SIZE) {
        return {
            x: size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r),
            y: size * (3/2 * r)
        };
    }

    // Get direct neighbors (sharing an edge)
    static getNeighbors(q, r) {
        return this.DIRECTIONS.map(dir => ({
            q: q + dir.q,
            r: r + dir.r
        }));
    }

    // Check if two hexes share an edge
    static areNeighbors(hex1, hex2) {
        const dq = Math.abs(hex1.q - hex2.q);
        const dr = Math.abs(hex1.r - hex2.r);
        // Hexes are neighbors if they share exactly one edge
        return (dq === 1 && dr === 0) || (dq === 0 && dr === 1) || (dq === 1 && dr === 1);
    }

    // Get hexes that share an edge with any hex in a set
    static getAdjacentToSet(hexSet, boardSize) {
        const adjacent = new Set();
        
        hexSet.forEach(hex => {
            const neighbors = this.getNeighbors(hex.q, hex.r)
                .filter(n => this.isValidPosition(n.q, n.r, boardSize));
            neighbors.forEach(n => adjacent.add(`${n.q},${n.r}`));
        });

        return Array.from(adjacent);
    }

    // Validate hex position is within board bounds
    static isValidPosition(q, r, boardSize) {
        return q >= 0 && q < boardSize && r >= 0 && r < boardSize;
    }

    // Find connected hexes of the same color
    static findConnectedColorGroup(startHex, board, color) {
        const connected = new Set();
        const toCheck = [startHex];
        const checked = new Set();

        while (toCheck.length > 0) {
            const hex = toCheck.pop();
            const key = `${hex.q},${hex.r}`;

            if (!checked.has(key)) {
                checked.add(key);
                const tile = board[key];

                if (tile && tile.color === color && !tile.owner) {
                    connected.add(key);
                    // Add all unchecked neighbors
                    this.getNeighbors(hex.q, hex.r)
                        .filter(n => this.isValidPosition(n.q, n.r, board.length))
                        .forEach(n => {
                            const nKey = `${n.q},${n.r}`;
                            if (!checked.has(nKey)) {
                                toCheck.push(n);
                            }
                        });
                }
            }
        }

        return Array.from(connected);
    }

    static roundAxial(q, r) {
        // Using cube coordinates for rounding
        let x = q;
        let z = r;
        let y = -x - z;

        let rx = Math.round(x);
        let ry = Math.round(y);
        let rz = Math.round(z);

        const xDiff = Math.abs(rx - x);
        const yDiff = Math.abs(ry - y);
        const zDiff = Math.abs(rz - z);

        if (xDiff > yDiff && xDiff > zDiff) {
            rx = -ry - rz;
        } else if (yDiff > zDiff) {
            ry = -rx - rz;
        } else {
            rz = -rx - ry;
        }

        return { q: rx, r: rz };
    }
}
