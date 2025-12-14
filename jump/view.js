class View {
    constructor(ctx, constants) {
        this.ctx = ctx;
        this.GRID_SIZE = constants.GRID_SIZE;
        this.RENDER_RADIUS = constants.RENDER_RADIUS;
        this.highlightedStartCircle = null;
        this.selectedPiece = null;
    }

    setState(circles, connections, pieces) {
        this.circles = circles;
        this.connections = connections;
        this.pieces = pieces;
    }

    isBearInSpot(circleIndex) {
        const circle = this.circles[circleIndex];
        if (circle.isStart1 || circle.isStart2) {
            return false;
        }
        
        for (let i = 0; i < this.circles.length; i++) {
            const otherCircle = this.circles[i];
            if (otherCircle.isStart1 || otherCircle.isStart2) {
                const neighbors = this.connections[i];
                if (neighbors && neighbors.includes(circleIndex)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    getBearInSpotPlayer(circleIndex) {
        for (let i = 0; i < this.circles.length; i++) {
            const otherCircle = this.circles[i];
            if (otherCircle.isStart1) {
                const neighbors = this.connections[i];
                if (neighbors && neighbors.includes(circleIndex)) {
                    return 1;
                }
            }
            if (otherCircle.isStart2) {
                const neighbors = this.connections[i];
                if (neighbors && neighbors.includes(circleIndex)) {
                    return 2;
                }
            }
        }
        return null;
    }

    getCircleFillColor(circle, circleIndex) {
        if (circle.isStart1) {
            return '#4a90e2';
        }
        if (circle.isStart2) {
            return '#e24a4a';
        }
        
        const bearInPlayer = this.getBearInSpotPlayer(circleIndex);
        if (bearInPlayer === 1) {
            return '#add8e6';
        }
        if (bearInPlayer === 2) {
            return '#ffc0cb';
        }
        
        return '#ddd';
    }

    renderConnections() {
        this.ctx.strokeStyle = '#ccc';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.circles.length; i++) {
            const circle = this.circles[i];
            const neighbors = this.connections[i];
            
            for (const neighborIndex of neighbors) {
                const neighbor = this.circles[neighborIndex];
                this.ctx.beginPath();
                this.ctx.moveTo(circle.x, circle.y);
                this.ctx.lineTo(neighbor.x, neighbor.y);
                this.ctx.stroke();
            }
        }
    }

    renderCircle(circle, circleIndex) {
        this.ctx.fillStyle = this.getCircleFillColor(circle, circleIndex);
        this.ctx.beginPath();
        this.ctx.arc(circle.x, circle.y, this.RENDER_RADIUS, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    renderPieceOnCircle(circle, piece) {
        const isSelected = this.selectedPiece === piece && !piece.inHolding;
        
        this.ctx.fillStyle = piece.player === 1 ? '#4a90e2' : '#e24a4a';
        this.ctx.beginPath();
        this.ctx.arc(circle.x, circle.y, this.RENDER_RADIUS * 0.6, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = isSelected ? '#ffff00' : '#fff';
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.stroke();
    }

    renderCircleHighlight(circle) {
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(circle.x, circle.y, this.RENDER_RADIUS, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    renderValidMoveHighlight(circle) {
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(circle.x, circle.y, this.RENDER_RADIUS, 0, Math.PI * 2);
        this.ctx.fill();
    }

    getPieceOnCircle(circleIndex) {
        for (const piece of this.pieces) {
            if (!piece.isRemoved && !piece.inHolding && piece.circleIndex === circleIndex) {
                return piece;
            }
        }
        return null;
    }

    renderValidMovesForSelectedPiece() {
        if (this.selectedPiece === null || this.selectedPiece.inHolding || this.selectedPiece.isRemoved) {
            return;
        }
        
        const currentCircleIndex = this.selectedPiece.circleIndex;
        if (currentCircleIndex === null) {
            return;
        }
        
        const neighbors = this.connections[currentCircleIndex];
        if (!neighbors) {
            return;
        }
        
        const validTargets = new Set();
        
        for (const neighborIndex of neighbors) {
            const neighbor = this.circles[neighborIndex];
            
            if (this.selectedPiece.player === 1 && neighbor.isStart1) {
                continue;
            }
            if (this.selectedPiece.player === 2 && neighbor.isStart2) {
                continue;
            }
            
            const occupyingPiece = this.getPieceOnCircle(neighborIndex);
            
            if (occupyingPiece === null) {
                validTargets.add(neighborIndex);
            } else {
                if (occupyingPiece.player !== this.selectedPiece.player) {
                    validTargets.add(neighborIndex);
                }
            }
            
            if (occupyingPiece !== null && occupyingPiece.player !== this.selectedPiece.player) {
                continue;
            }
            
            const intermediateNeighbors = this.connections[neighborIndex];
            for (const targetIndex of intermediateNeighbors) {
                if (targetIndex === currentCircleIndex) {
                    continue;
                }
                const targetCircle = this.circles[targetIndex];
                
                if (this.selectedPiece.player === 1 && targetCircle.isStart1) {
                    continue;
                }
                if (this.selectedPiece.player === 2 && targetCircle.isStart2) {
                    continue;
                }
                
                const targetOccupyingPiece = this.getPieceOnCircle(targetIndex);
                if (targetOccupyingPiece === null) {
                    validTargets.add(targetIndex);
                }
            }
        }
        
        for (const targetIndex of validTargets) {
            this.renderValidMoveHighlight(this.circles[targetIndex]);
        }
    }

    getPieceInHolding(player) {
        for (const piece of this.pieces) {
            if (piece.player === player && piece.inHolding && !piece.isRemoved) {
                return piece;
            }
        }
        return null;
    }

    renderHighlightedStartCircle() {
        if (this.highlightedStartCircle === null) {
            return;
        }
        
        const startCircle = this.circles[this.highlightedStartCircle];
        if (startCircle.occupiedBy === null) {
            const playerForStart = startCircle.isStart1 ? 1 : 2;
            const pieceInHolding = this.getPieceInHolding(playerForStart);
            
            if (pieceInHolding === null) {
                return;
            }
            
            const neighbors = this.connections[this.highlightedStartCircle];
            let hasValidMoves = false;
            
            for (const neighborIndex of neighbors) {
                if (neighborIndex === this.highlightedStartCircle) {
                    continue;
                }
                
                const neighbor = this.circles[neighborIndex];
                const occupyingPiece = this.getPieceOnCircle(neighborIndex);
                
                if (occupyingPiece !== null) {
                    continue;
                }
                
                hasValidMoves = true;
                this.renderValidMoveHighlight(neighbor);
            }
            
            if (hasValidMoves) {
                this.renderCircleHighlight(startCircle);
            }
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.GRID_SIZE, this.GRID_SIZE);
        
        this.renderConnections();
        
        for (let i = 0; i < this.circles.length; i++) {
            const circle = this.circles[i];
            
            this.renderCircle(circle, i);
            
            if (circle.occupiedBy !== null) {
                const piece = this.pieces[circle.occupiedBy];
                if (!piece.isRemoved) {
                    this.renderPieceOnCircle(circle, piece);
                }
            }
            
            if (this.selectedPiece !== null && !this.selectedPiece.inHolding && !this.selectedPiece.isRemoved && this.selectedPiece.circleIndex === i) {
                this.renderCircleHighlight(circle);
            }
        }
        
        this.renderValidMovesForSelectedPiece();
        this.renderHighlightedStartCircle();
    }
}



