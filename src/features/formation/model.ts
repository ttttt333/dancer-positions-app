import type { Formation, Position, Dancer } from '../../types';
import { generateUUID } from '../../lib/uuid';

export class FormationModel {
  static create(name: string, timestamp: number): Omit<Formation, 'id'> {
    return {
      name,
      timestamp,
      positions: [],
    };
  }

  static addPosition(formation: Formation, position: Position): Formation {
    return {
      ...formation,
      positions: formation.positions.filter(p => p.dancerId !== position.dancerId).concat(position),
    };
  }

  static removePosition(formation: Formation, dancerId: string): Formation {
    return {
      ...formation,
      positions: formation.positions.filter(p => p.dancerId !== dancerId),
    };
  }

  static updatePosition(formation: Formation, dancerId: string, position: Partial<Position>): Formation {
    return {
      ...formation,
      positions: formation.positions.map(p =>
        p.dancerId === dancerId ? { ...p, ...position } : p
      ),
    };
  }

  static getPosition(formation: Formation, dancerId: string): Position | undefined {
    return formation.positions.find(p => p.dancerId === dancerId);
  }

  static getDancersInFormation(formation: Formation, dancers: Dancer[]): Dancer[] {
    const dancerIds = new Set(formation.positions.map(p => p.dancerId));
    return dancers.filter(d => dancerIds.has(d.id));
  }

  static getDancersNotInFormation(formation: Formation, dancers: Dancer[]): Dancer[] {
    const dancerIds = new Set(formation.positions.map(p => p.dancerId));
    return dancers.filter(d => !dancerIds.has(d.id));
  }

  // プリセット配置生成
  static createCircleFormation(centerX: number, centerY: number, radius: number, dancerIds: string[]): Formation {
    const positions: Position[] = dancerIds.map((dancerId, index) => {
      const angle = (2 * Math.PI * index) / dancerIds.length;
      return {
        dancerId,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    return {
      id: generateUUID(),
      name: '円形配置',
      positions,
      timestamp: 0,
    };
  }

  static createLineFormation(startX: number, startY: number, endX: number, endY: number, dancerIds: string[]): Formation {
    const positions: Position[] = dancerIds.map((dancerId, index) => {
      const ratio = dancerIds.length > 1 ? index / (dancerIds.length - 1) : 0.5;
      return {
        dancerId,
        x: startX + (endX - startX) * ratio,
        y: startY + (endY - startY) * ratio,
      };
    });

    return {
      id: generateUUID(),
      name: 'ライン配置',
      positions,
      timestamp: 0,
    };
  }

  static createGridFormation(startX: number, startY: number, cols: number, spacing: number, dancerIds: string[]): Formation {
    const positions: Position[] = dancerIds.map((dancerId, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        dancerId,
        x: startX + col * spacing,
        y: startY + row * spacing,
      };
    });

    return {
      id: generateUUID(),
      name: 'グリッド配置',
      positions,
      timestamp: 0,
    };
  }
}
