// Genoma do agente genético: um peso para cada característica que ele observa.
// Fica num arquivo sem dependências para poder ser usado pelo agente e pelo treino.

export interface Gene {
  name: string;
  description: string;
}

/** Características de cada sala candidata (o agente vai para a de maior pontuação). */
export const CELL_GENES: Gene[] = [
  { name: 'Poço', description: 'Probabilidade de poço na sala' },
  { name: 'Wumpus', description: 'Probabilidade de o Wumpus estar na sala' },
  { name: 'Segura', description: '1 se a sala é comprovadamente segura' },
  { name: 'Distância', description: 'Passos até a sala (dividido pelo tamanho do mapa)' },
  { name: 'Novidade', description: 'Vizinhas ainda desconhecidas (de 0 a 1)' },
  { name: 'Longe da entrada', description: 'Distância da sala até (1, 1)' },
  { name: 'Giros', description: 'Quanto precisa girar antes do primeiro passo' },
  { name: 'Brisas ao lado', description: 'Vizinhas visitadas onde sentiu brisa' },
  { name: 'Fedores ao lado', description: 'Vizinhas visitadas onde sentiu fedor' },
];

/** Características da opção "atirar no Wumpus" (comparada com a melhor sala). */
export const SHOOT_GENES: Gene[] = [
  { name: 'Tiro: viés', description: 'Vontade de atirar, independente do resto' },
  { name: 'Tiro: certeza', description: 'Probabilidade de o alvo ser mesmo o Wumpus' },
  { name: 'Tiro: há sala segura', description: '1 se ainda existe sala segura para explorar' },
];

export const GENES = [...CELL_GENES, ...SHOOT_GENES];
export const GENE_LIMIT = 5; // cada peso fica entre -5 e 5

/** Genoma inicial que imita o agente probabilístico: foge do risco, prefere salas seguras e próximas. */
export const BAYES_LIKE_GENOME: number[] = [-5, -5, 5, -0.5, 0, 0, 0, 0, 0, 0, 2, -5];

/**
 * Genoma pré-treinado: evoluído a partir do BAYES_LIKE_GENOME em mapas 4×4 com 20% de poços
 * (população 24, 20 gerações, 120 mapas por geração, validação final em 360 mapas novos).
 */
export const DEFAULT_GENOME: number[] = [-4.67, -3.13, 3.97, -2.16, 0.85, 0.42, -0.34, -0.97, -0.64, 0.05, 0.65, -4.1];
