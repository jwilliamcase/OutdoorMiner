import { eventManager } from './eventManager.js';
import { GameEvents } from './eventTypes.js';

class MoveHistory {
    constructor() {
        this.moves = [];
        this.maxMoves = 50;
        this.currentIndex = -1;
    }

    addMove(move) {
        // Truncate future moves if we're not at the end
        if (this.currentIndex < this.moves.length - 1) {
            this.moves = this.moves.slice(0, this.currentIndex + 1);
        }

        this.moves.push({
            ...move,
            timestamp: Date.now(),
            index: this.moves.length
        });

        if (this.moves.length > this.maxMoves) {
            this.moves.shift();
        }

        this.currentIndex = this.moves.length - 1;
        return this.currentIndex;
    }

    getMoveAt(index) {
        return this.moves[index];
    }

    getCurrentMove() {
        return this.moves[this.currentIndex];
    }

    canUndo() {
        return this.currentIndex > 0;
    }

    canRedo() {
        return this.currentIndex < this.moves.length - 1;
    }

    serialize() {
        return JSON.stringify({
            moves: this.moves,
            currentIndex: this.currentIndex
        });
    }

    static deserialize(jsonString) {
        const data = JSON.parse(jsonString);
        const history = new MoveHistory();
        history.moves = data.moves;
        history.currentIndex = data.currentIndex;
        return history;
    }
}

export const moveHistory = new MoveHistory();
