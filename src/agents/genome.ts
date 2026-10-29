// Genoma do agente genético: um peso para cada característica que ele observa.
// Fica num arquivo sem dependências para poder ser usado pelo agente e pelo treino.

export interface Gene {
  name: string;
  description: string;
}

/**
 * Características de cada sala candidata (o agente vai para a de maior pontuação).
 * As duas primeiras estão nas unidades da pontuação: risco de morte (−1000) e passos (−1 cada),
 * como numa utilidade esperada (D19). As outras deixam o treino corrigir o que essa conta não vê.
 */
export const CELL_GENES: Gene[] = [
  { name: 'Risco', description: 'Chance de morrer na sala: P(poço) + P(Wumpus)' },
  { name: 'Distância', description: 'Passos até a sala (dividido pelo tamanho do mapa)' },
  { name: 'Segura', description: '1 se a sala é comprovadamente segura' },
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

/**
 * Genoma que reproduz o agente probabilístico: o menor risco decide, a distância só desempata,
 * e o tiro só acontece sem sala segura (como os passos 3 a 5 do ReasoningAgent).
 */
export const BAYES_LIKE_GENOME: number[] = [-5, -0.01, 0, 0, 0, 0, 0, 0, 0, 2, -5];

/** Genoma pré-treinado (provisório: igual ao BAYES_LIKE_GENOME até o treino terminar). */
export const DEFAULT_GENOME: number[] = [...BAYES_LIKE_GENOME];
